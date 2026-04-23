"""Import Fumigation, FSS Milling, and Grain Terminals data into location_points."""
import pandas as pd
import asyncio
import os
import re
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
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'PR': 'Puerto Rico',
}

US_CITIES_DF = pd.read_csv(ROOT_DIR / 'us_cities_coordinates.csv')
US_CITIES_DF['CITY_UPPER'] = US_CITIES_DF['CITY'].str.upper()
US_CITIES_DF['STATE_UPPER'] = US_CITIES_DF['STATE_NAME'].str.upper()

geocode_cache = {}

def geocode(city, state_full):
    city_clean = re.sub(r'^(elevator|port|terminal)\s+', '', city, flags=re.IGNORECASE).strip()
    cache_key = f"{city_clean.upper()},{state_full.upper()}"
    if cache_key in geocode_cache:
        return geocode_cache[cache_key]

    city_upper = city_clean.upper().strip()
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

    # Try without "St." vs "Saint" variations
    alt = city_upper.replace('ST.', 'SAINT').replace('ST ', 'SAINT ')
    matches = US_CITIES_DF[
        (US_CITIES_DF['CITY_UPPER'] == alt) &
        (US_CITIES_DF['STATE_UPPER'] == state_upper)
    ]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords

    # Fallback: city only
    matches = US_CITIES_DF[US_CITIES_DF['CITY_UPPER'] == city_upper]
    if not matches.empty:
        row = matches.iloc[0]
        coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
        geocode_cache[cache_key] = coords
        return coords

    geocode_cache[cache_key] = None
    return None


def to_state_full(raw):
    raw = str(raw).strip()
    if len(raw) == 2:
        return ABBREV_TO_STATE.get(raw.upper(), raw)
    return raw


def import_fumigation(df):
    """Import fumigation companies CSV."""
    points = []
    skipped = []
    for _, row in df.iterrows():
        company = str(row['Company']).strip() if pd.notna(row['Company']) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        region = str(row.get('Region', '')).strip() if pd.notna(row.get('Region', '')) else ''
        ftype = str(row.get('Type', '')).strip() if pd.notna(row.get('Type', '')) else ''

        if not city or not state_raw:
            skipped.append(f"Fumigation: empty city/state - {company}")
            continue

        state_full = to_state_full(state_raw)
        geo = geocode(city, state_full)
        if not geo:
            skipped.append(f"Fumigation: {city}, {state_raw} - {company}")
            continue

        points.append({
            'name': company,
            'layer': 'Grain Fumigation',
            'city': city.title(),
            'state': state_full,
            'lat': geo['lat'],
            'lon': geo['lon'],
            'type': ftype,
            'region': region,
        })

    return points, skipped


def import_fss_milling(df):
    """Import FSS milling locations CSV."""
    points = []
    skipped = []
    for _, row in df.iterrows():
        company = str(row['Company Name']).strip() if pd.notna(row['Company Name']) else ''
        category = str(row['Category']).strip() if pd.notna(row['Category']) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State_Parsed']).strip() if pd.notna(row['State_Parsed']) else ''
        capacity = str(row.get('Capacity', '')).strip() if pd.notna(row.get('Capacity', '')) else ''
        address = str(row.get('Street_Address', '')).strip() if pd.notna(row.get('Street_Address', '')) else ''

        if not city or not state_raw or not category or category == 'nan':
            skipped.append(f"FSS: empty city/state/category - {company}")
            continue

        state_full = to_state_full(state_raw)

        # Map category to layer name
        layer_map = {
            'Grain': 'FSS Grain',
            'Flour mills': 'FSS Flour Mills',
            'Specialty Mills': 'FSS Specialty Mills',
            'Mix Plants': 'FSS Mix Plants',
        }
        layer_name = layer_map.get(category)
        if not layer_name:
            skipped.append(f"FSS: unknown category '{category}' - {company}")
            continue

        geo = geocode(city, state_full)
        if not geo:
            skipped.append(f"FSS ({category}): {city}, {state_raw} - {company}")
            continue

        points.append({
            'name': company,
            'layer': layer_name,
            'city': city.title(),
            'state': state_full,
            'lat': geo['lat'],
            'lon': geo['lon'],
            'capacity': capacity,
            'address': address,
        })

    return points, skipped


def import_grain_terminals(df):
    """Import grain terminals XLSX."""
    points = []
    skipped = []
    for _, row in df.iterrows():
        commodity = str(row['commodity']).strip() if pd.notna(row['commodity']) else ''
        company = str(row['warehouse_company']).strip() if pd.notna(row['warehouse_company']) else ''
        city = str(row['city']).strip() if pd.notna(row['city']) else ''
        state_raw = str(row['state']).strip() if pd.notna(row['state']) else ''
        capacity = str(row.get('capacity_value', '')).strip() if pd.notna(row.get('capacity_value', '')) else ''

        if not city or not state_raw or not commodity:
            skipped.append(f"Terminals: empty - {company}")
            continue

        # Skip THROUGH PUT rows
        if 'THROUGH PUT' in commodity.upper():
            skipped.append(f"Terminals: THROUGH PUT row - {company}")
            continue

        state_full = to_state_full(state_raw)

        # Handle "SRW Wheat, Oats" → assign to SRW Wheat
        if ',' in commodity:
            commodity = commodity.split(',')[0].strip()

        layer_name = f"Terminals {commodity}"

        geo = geocode(city, state_full)
        if not geo:
            skipped.append(f"Terminals ({commodity}): {city}, {state_raw} - {company}")
            continue

        points.append({
            'name': company,
            'layer': layer_name,
            'city': city.title(),
            'state': state_full,
            'lat': geo['lat'],
            'lon': geo['lon'],
            'capacity': capacity,
            'commodity': commodity,
        })

    return points, skipped


async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db_obj = client[os.environ['DB_NAME']]

    # Read files
    df_fum = pd.read_csv('/tmp/fumigation.csv')
    df_fss = pd.read_csv('/tmp/fss_milling.csv')
    df_term = pd.read_excel('/tmp/grain_terminals.xlsx')

    # Import each
    print("=" * 60)
    fum_pts, fum_skip = import_fumigation(df_fum)
    print(f"Fumigation: {len(fum_pts)} geocoded, {len(fum_skip)} skipped")
    for s in fum_skip[:10]:
        print(f"  {s}")

    print("=" * 60)
    fss_pts, fss_skip = import_fss_milling(df_fss)
    print(f"FSS Milling: {len(fss_pts)} geocoded, {len(fss_skip)} skipped")
    # Show per-layer counts
    fss_layers = {}
    for p in fss_pts:
        fss_layers[p['layer']] = fss_layers.get(p['layer'], 0) + 1
    for l, c in sorted(fss_layers.items()):
        print(f"  {l}: {c}")
    print(f"  Skipped samples:")
    for s in fss_skip[:10]:
        print(f"    {s}")

    print("=" * 60)
    term_pts, term_skip = import_grain_terminals(df_term)
    print(f"Grain Terminals: {len(term_pts)} geocoded, {len(term_skip)} skipped")
    term_layers = {}
    for p in term_pts:
        term_layers[p['layer']] = term_layers.get(p['layer'], 0) + 1
    for l, c in sorted(term_layers.items()):
        print(f"  {l}: {c}")
    print(f"  Skipped samples:")
    for s in term_skip[:10]:
        print(f"    {s}")

    # Delete old data for these layers
    all_new_layers = set(p['layer'] for p in fum_pts + fss_pts + term_pts)
    for layer in all_new_layers:
        result = await db_obj.location_points.delete_many({'layer': layer})
        if result.deleted_count > 0:
            print(f"  Deleted {result.deleted_count} old '{layer}' records")

    # Insert all
    all_points = fum_pts + fss_pts + term_pts
    if all_points:
        await db_obj.location_points.insert_many(all_points)
    print(f"\nInserted {len(all_points)} total location_points")

    # Final count
    total = await db_obj.location_points.count_documents({})
    print(f"Total location_points in DB: {total}")

    client.close()


if __name__ == '__main__':
    asyncio.run(main())
