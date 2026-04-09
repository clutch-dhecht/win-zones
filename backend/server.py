from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any
import uuid
from datetime import datetime, timezone
import pandas as pd
import io
from us_cities_data import geocode_city, is_us_state

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class CityDataPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    state: str
    city: str
    lat: float
    lon: float
    layers: Dict[str, int]

class CountyDataPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    state: str
    county: str
    layers: Dict[str, int]

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

@api_router.post("/upload/city")
async def upload_city_data(file: UploadFile = File(...)):
    """Upload and process city-level CSV data"""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        if 'State' not in df.columns or 'City' not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must have 'State' and 'City' columns")
        
        # Filter to US states only
        df = df[df['State'].apply(is_us_state)]
        
        # Get layer columns (all columns except State and City)
        layer_columns = [col for col in df.columns if col not in ['State', 'City']]
        
        processed_data = []
        skipped_count = 0
        
        for _, row in df.iterrows():
            geo = geocode_city(row['City'], row['State'])
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
        
        # Store in MongoDB
        await db.city_data.delete_many({})
        if processed_data:
            await db.city_data.insert_many(processed_data)
        
        return {
            "success": True,
            "processed": len(processed_data),
            "skipped": skipped_count,
            "layers": layer_columns
        }
    except Exception as e:
        logging.error(f"Error processing city data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/upload/county")
async def upload_county_data(file: UploadFile = File(...)):
    """Upload and process county-level CSV data"""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        if 'State' not in df.columns or 'County' not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must have 'State' and 'County' columns")
        
        # Filter to US states only
        df = df[df['State'].apply(is_us_state)]
        
        # Get layer columns
        layer_columns = [col for col in df.columns if col not in ['State', 'County']]
        
        processed_data = []
        for _, row in df.iterrows():
            layers = {col: int(row[col]) if pd.notna(row[col]) else 0 for col in layer_columns}
            processed_data.append({
                'state': row['State'],
                'county': row['County'].upper(),
                'layers': layers
            })
        
        # Store in MongoDB
        await db.county_data.delete_many({})
        if processed_data:
            await db.county_data.insert_many(processed_data)
        
        return {
            "success": True,
            "processed": len(processed_data),
            "layers": layer_columns
        }
    except Exception as e:
        logging.error(f"Error processing county data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/data/city")
async def get_city_data():
    """Get all city data with geocoding"""
    data = await db.city_data.find({}, {"_id": 0}).to_list(10000)
    return {"data": data}

@api_router.get("/data/county")
async def get_county_data():
    """Get all county data"""
    data = await db.county_data.find({}, {"_id": 0}).to_list(10000)
    return {"data": data}

@api_router.get("/analytics/top-zones")
async def get_top_zones(layers: str = ""):
    """Calculate top opportunity zones based on active layers"""
    try:
        active_layers = layers.split(',') if layers else []
        
        # Get city data
        city_data = await db.city_data.find({}, {"_id": 0}).to_list(10000)
        county_data = await db.county_data.find({}, {"_id": 0}).to_list(10000)
        
        # Aggregate by state
        state_totals = {}
        
        for city in city_data:
            state = city['state']
            if state not in state_totals:
                state_totals[state] = 0
            
            for layer, value in city['layers'].items():
                if not active_layers or layer in active_layers:
                    state_totals[state] += value
        
        for county in county_data:
            state = county['state']
            if state not in state_totals:
                state_totals[state] = 0
            
            for layer, value in county['layers'].items():
                if not active_layers or layer in active_layers:
                    state_totals[state] += value
        
        # Sort and get top 10
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
