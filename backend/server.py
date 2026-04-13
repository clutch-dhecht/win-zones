from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne
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

# Column rename map: CSV column name -> display layer name
COLUMN_RENAME_MAP = {
    'RICE - ACRES HARVESTED': 'Rice Acres',
    'CORN, GRAIN - ACRES HARVESTED': 'Corn Acres',
}

# Layer rename map: old name -> new name (for migrating existing data)
LAYER_RENAME_MAP = {
    'Customers': 'CLS Customers',
    '1000-plus Acre Growers': '1000+ Wheat Growers',
    'Acres': 'Wheat Acres',
}

# Layers to remove from existing data
LAYERS_TO_REMOVE = ['Feed Mills', 'Hog Producers', 'Grain Fumigation', 'Grain Retail Handlers']

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

# Map of first-column names to layer names for location-list CSVs
LOCATION_LAYER_MAP = {
    'Grain Elevators': 'Grain Elevators',
    'Feed Manufacturers': 'Feed Manufacturers',
    'Animal feed stores': 'Feed Stores',
    'Pest Control Companies': 'Pest Control',
}

# ── POINT DATA (City, State + numeric layers) ──

@api_router.post("/upload/point")
async def upload_point_data(file: UploadFile = File(...)):
    """Upload point-level CSV data. Supports two formats:
    1. City/State + numeric layer columns (aggregated)
    2. Location lists with lat/lon (name, street, city, state, zip, lat, lon)
    """
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        # Detect format: location list (has latitude/longitude) vs aggregated (City/State + numbers)
        has_coords = 'latitude' in df.columns and 'longitude' in df.columns
        has_city_state = 'City' in df.columns and 'State' in df.columns

        if has_coords:
            # Location list format — first column is the business type name
            first_col = df.columns[0]
            layer_name = LOCATION_LAYER_MAP.get(first_col, first_col)

            # Normalize state column (might be lowercase 'state')
            state_col = 'state' if 'state' in df.columns else 'State'
            city_col = 'city' if 'city' in df.columns else 'City'

            # Filter valid rows
            df = df.dropna(subset=['latitude', 'longitude', state_col, city_col])
            df = df[df[state_col].apply(lambda s: is_us_state(str(s).strip()))]

            # Deduplicate by lat/lon (some CSVs have duplicate rows)
            df = df.drop_duplicates(subset=['latitude', 'longitude', first_col])

            # Aggregate by city/state: count occurrences
            grouped = df.groupby([city_col, state_col]).agg(
                lat=('latitude', 'first'),
                lon=('longitude', 'first'),
                count=(first_col, 'count')
            ).reset_index()

            processed_data = []
            for _, row in grouped.iterrows():
                processed_data.append({
                    'state': str(row[state_col]).strip(),
                    'city': str(row[city_col]).strip(),
                    'lat': float(row['lat']),
                    'lon': float(row['lon']),
                    'layers': {layer_name: int(row['count'])}
                })

            # Merge with existing point data
            existing = await db.point_data.find({}, {"_id": 0}).to_list(50000)
            lookup = {}
            for doc in existing:
                key = f"{doc['state']}|{doc['city']}"
                lookup[key] = doc
            for item in processed_data:
                key = f"{item['state']}|{item['city']}"
                if key in lookup:
                    lookup[key]['layers'][layer_name] = item['layers'][layer_name]
                    # Update coords if not already set
                    if not lookup[key].get('lat'):
                        lookup[key]['lat'] = item['lat']
                        lookup[key]['lon'] = item['lon']
                else:
                    lookup[key] = item

            merged = list(lookup.values())
            await db.point_data.delete_many({})
            if merged:
                await db.point_data.insert_many(merged)

            # Collect all layer names
            all_layers = set()
            for d in merged:
                all_layers.update(d['layers'].keys())

            logging.info(f"Point upload (location list): {len(processed_data)} cities for '{layer_name}', {len(merged)} total")
            return {
                "success": True,
                "processed": len(df),
                "cities": len(processed_data),
                "total": len(merged),
                "layers": sorted(all_layers),
                "layer_added": layer_name
            }

        elif has_city_state:
            # Original aggregated format
            df = df[df['State'].apply(is_us_state)]
            skip_cols = {'State', 'City', 'Program', 'Year', 'Source', 'Period'}
            layer_columns = [col for col in df.columns if col not in skip_cols]

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

            # Merge with existing
            existing = await db.point_data.find({}, {"_id": 0}).to_list(50000)
            lookup = {}
            for doc in existing:
                key = f"{doc['state']}|{doc['city']}"
                lookup[key] = doc
            for item in processed_data:
                key = f"{item['state']}|{item['city']}"
                if key in lookup:
                    lookup[key]['layers'].update(item['layers'])
                else:
                    lookup[key] = item

            merged = list(lookup.values())
            await db.point_data.delete_many({})
            if merged:
                await db.point_data.insert_many(merged)

            all_layers = set()
            for d in merged:
                all_layers.update(d['layers'].keys())

            logging.info(f"Point upload (aggregated): {len(processed_data)} geocoded, {skipped_count} skipped, {len(merged)} total")
            return {"success": True, "processed": len(processed_data), "skipped": skipped_count, "total": len(merged), "layers": sorted(all_layers)}

        else:
            raise HTTPException(status_code=400, detail="CSV must have either 'City'+'State' or 'latitude'+'longitude' columns")

    except HTTPException:
        raise
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
    data = await db.point_data.find({}, {"_id": 0}).to_list(100000)
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

        # Columns that are not State/County and not known non-data columns
        skip_cols = {'State', 'County', 'Program', 'Year', 'Source', 'Period'}
        layer_columns = [col for col in df.columns if col not in skip_cols]

        # Auto-rename known columns
        col_renames = {col: COLUMN_RENAME_MAP.get(col, col) for col in layer_columns}
        df = df.rename(columns=col_renames)
        layer_columns = [col_renames.get(col, col) for col in layer_columns]

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

@app.on_event("startup")
async def migrate_layer_names():
    """One-time migration: rename and remove layers in existing data."""
    try:
        # Migrate point data (city_data and point_data collections)
        for coll_name in ['city_data', 'point_data']:
            coll = db[coll_name]
            docs = await coll.find({}).to_list(50000)
            if not docs:
                continue
            bulk_ops = []
            for doc in docs:
                layers = doc.get('layers', {})
                changed = False
                new_layers = {}
                for key, val in layers.items():
                    if key in LAYERS_TO_REMOVE:
                        changed = True
                        continue
                    if key in LAYER_RENAME_MAP:
                        new_layers[LAYER_RENAME_MAP[key]] = val
                        changed = True
                    else:
                        new_layers[key] = val
                if changed:
                    bulk_ops.append(UpdateOne({'_id': doc['_id']}, {'$set': {'layers': new_layers}}))
            if bulk_ops:
                await coll.bulk_write(bulk_ops)
                logger.info(f"Migrated {len(bulk_ops)} docs in {coll_name}")

        # Migrate density data (density_data, county_data, wheat_data)
        for coll_name in ['density_data', 'county_data', 'wheat_data']:
            coll = db[coll_name]
            docs = await coll.find({}).to_list(50000)
            if not docs:
                continue
            bulk_ops = []
            for doc in docs:
                layers = doc.get('layers', {})
                changed = False
                new_layers = {}
                for key, val in layers.items():
                    if key in LAYERS_TO_REMOVE:
                        changed = True
                        continue
                    if key in LAYER_RENAME_MAP:
                        new_layers[LAYER_RENAME_MAP[key]] = val
                        changed = True
                    else:
                        new_layers[key] = val
                if changed:
                    bulk_ops.append(UpdateOne({'_id': doc['_id']}, {'$set': {'layers': new_layers}}))
            if bulk_ops:
                await coll.bulk_write(bulk_ops)
                logger.info(f"Migrated {len(bulk_ops)} docs in {coll_name}")

        logger.info("Layer migration complete")
    except Exception as e:
        logger.error(f"Migration error: {e}")
