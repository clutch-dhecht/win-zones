from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict
import uuid
from datetime import datetime, timezone
import pandas as pd
import io
from us_cities_data import is_us_state

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Load comprehensive US cities database
US_CITIES_DF = pd.read_csv(ROOT_DIR / 'us_cities_coordinates.csv')
US_CITIES_DF['CITY_UPPER'] = US_CITIES_DF['CITY'].str.upper()
US_CITIES_DF['STATE_UPPER'] = US_CITIES_DF['STATE_NAME'].str.upper()

geocode_cache = {}

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.get("/")
async def root():
    return {"message": "Territory Atlas API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

def geocode_city_advanced(city, state):
    cache_key = f"{city.upper()},{state.upper()}"
    if cache_key in geocode_cache:
        return geocode_cache[cache_key]

    city_upper = city.upper().strip()
    state_upper = state.upper().strip()

    matches = US_CITIES_DF[
        (US_CITIES_DF['CITY_UPPER'] == city_upper) &
        (US_CITIES_DF['STATE_UPPER'] == state_upper)
    ]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords

    matches = US_CITIES_DF[US_CITIES_DF['CITY_UPPER'] == city_upper]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords

    geocode_cache[cache_key] = None
    return None

# ── POINT DATA (City, State + numeric layers) ──

@api_router.post("/upload/point")
async def upload_point_data(file: UploadFile = File(...)):
    """Upload point-level CSV data (City/State with numeric layers)"""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        if 'State' not in df.columns or 'City' not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must have 'State' and 'City' columns")

        df = df[df['State'].apply(is_us_state)]
        layer_columns = [col for col in df.columns if col not in ['State', 'City']]

        processed_data = []
        skipped_count = 0

        for idx, row in df.iterrows():
            geo = geocode_city_advanced(row['City'], row['State'])
            if geo:
                layers = {col: int(row[col]) if pd.notna(row[col]) else 0 for col in layer_columns}
                processed_data.append({
                    'state': row['State'],
                    'city': row['City'],
                    'lat': geo['lat'],
                    'lon': geo['lon'],
                    'layers': layers
                })
            else:
                skipped_count += 1

            if (idx + 1) % 50 == 0:
                logging.info(f"Geocoding progress: {idx + 1}/{len(df)}, {len(processed_data)} successful")

        await db.point_data.delete_many({})
        if processed_data:
            await db.point_data.insert_many(processed_data)

        logging.info(f"Point upload: {len(processed_data)} geocoded, {skipped_count} skipped")
        return {"success": True, "processed": len(processed_data), "skipped": skipped_count, "layers": layer_columns}
    except Exception as e:
        logging.error(f"Error processing point data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Keep legacy endpoint for backwards compat with existing data
@api_router.post("/upload/city")
async def upload_city_data(file: UploadFile = File(...)):
    return await upload_point_data(file)

@api_router.get("/data/point")
async def get_point_data():
    """Get all point data. Checks new collection first, falls back to legacy."""
    data = await db.point_data.find({}, {"_id": 0}).to_list(10000)
    if not data:
        data = await db.city_data.find({}, {"_id": 0}).to_list(10000)
    return {"data": data}

@api_router.get("/data/city")
async def get_city_data():
    return await get_point_data()

# ── DENSITY DATA (County, State + numeric layers) ──

@api_router.post("/upload/density")
async def upload_density_data(file: UploadFile = File(...)):
    """Upload county-level density CSV data (County/State with numeric layers).
    Handles comma-formatted numbers automatically."""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        if 'State' not in df.columns or 'County' not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must have 'State' and 'County' columns")

        layer_columns = [col for col in df.columns if col not in ['State', 'County']]

        processed_data = []
        for _, row in df.iterrows():
            state_val = str(row['State']).strip()
            if not is_us_state(state_val):
                continue

            layers = {}
            for col in layer_columns:
                value = row[col]
                if isinstance(value, str):
                    value = value.replace(',', '')
                layers[col] = int(float(value)) if pd.notna(value) else 0

            processed_data.append({
                'state': state_val,
                'county': str(row['County']).upper().strip(),
                'layers': layers
            })

        # Merge with existing density data: load existing, merge layers, save
        existing = await db.density_data.find({}, {"_id": 0}).to_list(50000)
        existing_lookup = {}
        for doc in existing:
            key = f"{doc['state']}|{doc['county']}"
            existing_lookup[key] = doc

        # Merge new data into existing
        for item in processed_data:
            key = f"{item['state']}|{item['county']}"
            if key in existing_lookup:
                # Merge layers (new layers overwrite existing for same name)
                existing_lookup[key]['layers'].update(item['layers'])
            else:
                existing_lookup[key] = item

        merged = list(existing_lookup.values())

        await db.density_data.delete_many({})
        if merged:
            await db.density_data.insert_many(merged)

        # Collect all layer names across merged data
        all_layers = set()
        for d in merged:
            all_layers.update(d['layers'].keys())

        logging.info(f"Density upload: {len(processed_data)} new records merged into {len(merged)} total")
        return {"success": True, "processed": len(processed_data), "total": len(merged), "layers": sorted(all_layers)}
    except Exception as e:
        logging.error(f"Error processing density data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Legacy endpoints
@api_router.post("/upload/county")
async def upload_county_data(file: UploadFile = File(...)):
    return await upload_density_data(file)

@api_router.post("/upload/wheat")
async def upload_wheat_data(file: UploadFile = File(...)):
    return await upload_density_data(file)

@api_router.get("/data/density")
async def get_density_data():
    """Get all density data. Checks new collection first, falls back to legacy merge."""
    data = await db.density_data.find({}, {"_id": 0}).to_list(50000)
    if not data:
        # Fallback: merge old county_data + wheat_data
        county = await db.county_data.find({}, {"_id": 0}).to_list(10000)
        wheat = await db.wheat_data.find({}, {"_id": 0}).to_list(10000)
        lookup = {}
        for doc in county + wheat:
            key = f"{doc['state']}|{doc['county']}"
            if key in lookup:
                lookup[key]['layers'].update(doc['layers'])
            else:
                lookup[key] = doc
        data = list(lookup.values())
    return {"data": data}

@api_router.get("/data/county")
async def get_county_data():
    return await get_density_data()

@api_router.get("/data/wheat")
async def get_wheat_data():
    return await get_density_data()

# ── ANALYTICS ──

@api_router.get("/analytics/top-zones")
async def get_top_zones(layers: str = ""):
    try:
        active_layers = layers.split(',') if layers else []

        point_data = (await get_point_data())['data']
        density_data = (await get_density_data())['data']

        state_totals = {}

        for item in point_data:
            state = item['state']
            if state not in state_totals:
                state_totals[state] = 0
            for layer, value in item['layers'].items():
                if not active_layers or layer in active_layers:
                    state_totals[state] += value

        for item in density_data:
            state = item['state']
            if state not in state_totals:
                state_totals[state] = 0
            for layer, value in item['layers'].items():
                if not active_layers or layer in active_layers:
                    state_totals[state] += value

        top_zones = sorted(state_totals.items(), key=lambda x: x[1], reverse=True)[:10]
        return {
            "top_zones": [{"state": state, "total": total} for state, total in top_zones],
            "total_count": sum(state_totals.values())
        }
    except Exception as e:
        logging.error(f"Error calculating top zones: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
