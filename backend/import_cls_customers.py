"""Import CLS Customers from XLSX file into location_points collection."""
import pandas as pd
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Reverse state abbreviation mapping
ABBREV_TO_STATE = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming'
}

# Load US cities coordinates
US_CITIES_DF = pd.read_csv(ROOT_DIR / 'us_cities_coordinates.csv')
US_CITIES_DF['CITY_UPPER'] = US_CITIES_DF['CITY'].str.upper()
US_CITIES_DF['STATE_UPPER'] = US_CITIES_DF['STATE_NAME'].str.upper()

geocode_cache = {}

def geocode_city(city, state_full):
    cache_key = f"{city.upper()},{state_full.upper()}"
    if cache_key in geocode_cache:
        return geocode_cache[cache_key]

    city_upper = city.upper().strip()
    state_upper = state_full.upper().strip()

    matches = US_CITIES_DF[
        (US_CITIES_DF['CITY_UPPER'] == city_upper) &
        (US_CITIES_DF['STATE_UPPER'] == state_upper)
    ]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords

    # Fallback: match city only
    matches = US_CITIES_DF[US_CITIES_DF['CITY_UPPER'] == city_upper]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords

    geocode_cache[cache_key] = None
    return None


async def import_cls_customers(xlsx_path):
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db_obj = client[os.environ['DB_NAME']]

    # Read XLSX
    df = pd.read_excel(xlsx_path)
    print(f"Read {len(df)} rows from {xlsx_path}")
    print(f"Columns: {list(df.columns)}")

    # Normalize column names
    col_map = {}
    for col in df.columns:
        lower = col.strip().lower()
        if 'customer' in lower and 'name' in lower:
            col_map['customer_name'] = col
        elif 'ship' in lower and 'name' in lower:
            col_map['ship_to_name'] = col
        elif lower == 'city':
            col_map['city'] = col
        elif lower == 'state':
            col_map['state'] = col

    print(f"Column mapping: {col_map}")

    points = []
    skipped = []

    for idx, row in df.iterrows():
        customer_name = str(row[col_map['customer_name']]).strip() if pd.notna(row[col_map['customer_name']]) else ''
        ship_to_name = str(row[col_map['ship_to_name']]).strip() if pd.notna(row[col_map['ship_to_name']]) else ''
        city = str(row[col_map['city']]).strip() if pd.notna(row[col_map['city']]) else ''
        state_raw = str(row[col_map['state']]).strip() if pd.notna(row[col_map['state']]) else ''

        if not city or not state_raw:
            skipped.append(f"Row {idx}: empty city/state")
            continue

        # Convert state abbreviation to full name
        state_full = ABBREV_TO_STATE.get(state_raw.upper(), state_raw)

        geo = geocode_city(city, state_full)
        if not geo:
            skipped.append(f"Row {idx}: {city}, {state_raw} ({state_full}) - not found")
            continue

        points.append({
            'name': ship_to_name or customer_name,
            'customer_name': customer_name,
            'ship_to_name': ship_to_name,
            'layer': 'CLS Customers',
            'city': city.title(),
            'state': state_full,
            'lat': geo['lat'],
            'lon': geo['lon'],
        })

    print(f"\nGeocoded: {len(points)} / {len(df)}")
    print(f"Skipped: {len(skipped)}")
    if skipped[:20]:
        print("First 20 skipped:")
        for s in skipped[:20]:
            print(f"  {s}")

    # Remove old CLS Customers from both collections
    del_loc = await db_obj.location_points.delete_many({'layer': 'CLS Customers'})
    print(f"\nDeleted {del_loc.deleted_count} old CLS location_points")

    # Remove CLS Customers layer from point_data
    point_docs = await db_obj.point_data.find({}, {"_id": 0}).to_list(100000)
    updated_docs = []
    for doc in point_docs:
        if 'CLS Customers' in doc.get('layers', {}):
            del doc['layers']['CLS Customers']
            if doc['layers']:  # Still has other layers
                updated_docs.append(doc)
        else:
            updated_docs.append(doc)

    await db_obj.point_data.delete_many({})
    if updated_docs:
        await db_obj.point_data.insert_many(updated_docs)
    print(f"Cleaned CLS from point_data: {len(point_docs)} -> {len(updated_docs)} docs remaining")

    # Insert new CLS Customers as individual location_points
    if points:
        await db_obj.location_points.insert_many(points)
    print(f"Inserted {len(points)} CLS Customer location_points")

    # Summary
    unique_cities = len(set(f"{p['city']}|{p['state']}" for p in points))
    unique_customers = len(set(p['customer_name'] for p in points))
    print(f"\nSummary:")
    print(f"  Total points: {len(points)}")
    print(f"  Unique cities: {unique_cities}")
    print(f"  Unique customers: {unique_customers}")
    print(f"  States: {sorted(set(p['state'] for p in points))}")

    client.close()


if __name__ == '__main__':
    xlsx_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/cls_customers.xlsx'
    asyncio.run(import_cls_customers(xlsx_path))
