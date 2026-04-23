"""Import CHS Locations into location_points as CHS Grain / CHS Agronomy sub-layers."""
import pandas as pd
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
    'WI': 'Wisconsin', 'WY': 'Wyoming',
}

US_CITIES_DF = pd.read_csv(ROOT_DIR / 'us_cities_coordinates.csv')
US_CITIES_DF['CITY_UPPER'] = US_CITIES_DF['CITY'].str.upper()
US_CITIES_DF['STATE_UPPER'] = US_CITIES_DF['STATE_NAME'].str.upper()

geocode_cache = {}

def geocode(city, state_full):
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
    matches = US_CITIES_DF[US_CITIES_DF['CITY_UPPER'] == city_upper]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords
    geocode_cache[cache_key] = None
    return None


async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    df = pd.read_excel('/tmp/chs_all.xlsx')
    print(f"Read {len(df)} rows")

    points = []
    skipped = []

    for _, row in df.iterrows():
        name = str(row['Location Name']).strip() if pd.notna(row['Location Name']) else ''
        division = str(row['Division']).strip() if pd.notna(row['Division']) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        address = str(row['Address']).strip() if pd.notna(row['Address']) else ''
        is_grain = str(row.get('Grain', '')).strip().lower() == 'yes'
        is_agro = str(row.get('Agronomy', '')).strip().lower() == 'yes'

        if not city or not state_raw:
            skipped.append(f"empty city/state: {name}")
            continue

        state_full = ABBREV_TO_STATE.get(state_raw.upper(), state_raw)
        geo = geocode(city, state_full)
        if not geo:
            skipped.append(f"{city}, {state_raw} - {name}")
            continue

        layers = []
        if is_grain:
            layers.append('CHS Grain')
        if is_agro:
            layers.append('CHS Agronomy')
        if not layers:
            layers.append('CHS Grain')

        for layer in layers:
            points.append({
                'name': name,
                'division': division,
                'layer': layer,
                'city': city.title(),
                'state': state_full,
                'address': address,
                'lat': geo['lat'],
                'lon': geo['lon'],
            })

    grain_ct = sum(1 for p in points if p['layer'] == 'CHS Grain')
    agro_ct = sum(1 for p in points if p['layer'] == 'CHS Agronomy')
    print(f"Points: {len(points)} (CHS Grain: {grain_ct}, CHS Agronomy: {agro_ct})")
    print(f"Skipped: {len(skipped)}")
    for s in skipped[:15]:
        print(f"  {s}")

    # Remove old CHS data and insert new
    await db.location_points.delete_many({'layer': {'$in': ['CHS Grain', 'CHS Agronomy']}})
    if points:
        await db.location_points.insert_many(points)
    print(f"Inserted {len(points)} CHS location_points")

    total = await db.location_points.count_documents({})
    print(f"Total location_points in DB: {total}")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
