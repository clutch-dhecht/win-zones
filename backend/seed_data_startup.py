"""Startup data seeder — ensures all imported datasets exist in MongoDB.
Runs on app startup, checks if layers exist, imports missing ones.
"""
import pandas as pd
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).parent / 'seed_data'

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

US_CITIES_DF = None

def _load_cities():
    global US_CITIES_DF
    if US_CITIES_DF is None:
        csv_path = Path(__file__).parent / 'us_cities_coordinates.csv'
        US_CITIES_DF = pd.read_csv(csv_path)
        US_CITIES_DF['CITY_UPPER'] = US_CITIES_DF['CITY'].str.upper()
        US_CITIES_DF['STATE_UPPER'] = US_CITIES_DF['STATE_NAME'].str.upper()
    return US_CITIES_DF

_geocode_cache = {}

def _geocode(city, state_full):
    df = _load_cities()
    city_clean = re.sub(r'^(elevator|port|terminal)\s+', '', city, flags=re.IGNORECASE).strip()
    cache_key = f"{city_clean.upper()},{state_full.upper()}"
    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]
    city_upper = city_clean.upper().strip()
    state_upper = state_full.upper().strip()
    matches = df[(df['CITY_UPPER'] == city_upper) & (df['STATE_UPPER'] == state_upper)]
    if matches.empty:
        alt = city_upper.replace('ST.', 'SAINT').replace('ST ', 'SAINT ')
        matches = df[(df['CITY_UPPER'] == alt) & (df['STATE_UPPER'] == state_upper)]
    if matches.empty:
        matches = df[df['CITY_UPPER'] == city_upper]
    if matches.empty:
        _geocode_cache[cache_key] = None
        return None
    row = matches.iloc[0]
    coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
    _geocode_cache[cache_key] = coords
    return coords

def _to_state_full(raw):
    raw = str(raw).strip()
    return ABBREV_TO_STATE.get(raw.upper(), raw) if len(raw) == 2 else raw


async def seed_all(db):
    """Run all seed checks. Only imports data if the layer is missing."""
    try:
        existing_layers = await db.location_points.distinct('layer')
        existing_set = set(existing_layers)
        logger.info(f"Existing location_point layers: {existing_set}")

        await _seed_cls_customers(db, existing_set)
        await _seed_fumigation(db, existing_set)
        await _seed_fss_milling(db, existing_set)
        await _seed_grain_terminals(db, existing_set)
        await _seed_chs(db, existing_set)
        await _seed_mkc(db, existing_set)
        await _seed_mcgregor(db, existing_set)
        await _seed_hogs(db)

        logger.info("Seed check complete")
    except Exception as e:
        logger.error(f"Seed error: {e}")


async def _seed_cls_customers(db, existing_set):
    if 'CLS Customer Head Sheds' in existing_set:
        count = await db.location_points.count_documents({'layer': 'CLS Customer Head Sheds'})
        if count > 500:
            return
    xlsx = SEED_DIR / 'cls_customers.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding CLS Customer Head Sheds...")
    df = pd.read_excel(xlsx)
    cols = {c.strip().lower(): c for c in df.columns}
    cust_col = next(cols[k] for k in cols if 'customer' in k and 'name' in k)
    ship_col = next(cols[k] for k in cols if 'ship' in k and 'name' in k)
    city_col = next(cols[k] for k in cols if k == 'city')
    state_col = next(cols[k] for k in cols if k == 'state')
    points = []
    for _, row in df.iterrows():
        cname = str(row[cust_col]).strip() if pd.notna(row[cust_col]) else ''
        sname = str(row[ship_col]).strip() if pd.notna(row[ship_col]) else ''
        city = str(row[city_col]).strip() if pd.notna(row[city_col]) else ''
        state_raw = str(row[state_col]).strip() if pd.notna(row[state_col]) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        points.append({'name': sname or cname, 'customer_name': cname, 'ship_to_name': sname,
                       'layer': 'CLS Customer Head Sheds', 'city': city.title(), 'state': state_full,
                       'lat': geo['lat'], 'lon': geo['lon']})
    await db.location_points.delete_many({'layer': 'CLS Customer Head Sheds'})
    # Also clean legacy point_data/city_data
    await db.point_data.delete_many({})
    await db.city_data.delete_many({})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} CLS Customer Head Sheds")


async def _seed_fumigation(db, existing_set):
    if 'Grain Fumigation' in existing_set:
        return
    csv_path = SEED_DIR / 'fumigation.csv'
    if not csv_path.exists():
        return
    logger.info("Seeding Grain Fumigation...")
    df = pd.read_csv(csv_path)
    points = []
    for _, row in df.iterrows():
        company = str(row['Company']).strip() if pd.notna(row['Company']) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        points.append({'name': company, 'layer': 'Grain Fumigation', 'city': city.title(),
                       'state': state_full, 'lat': geo['lat'], 'lon': geo['lon'],
                       'type': str(row.get('Type', '')).strip() if pd.notna(row.get('Type', '')) else '',
                       'region': str(row.get('Region', '')).strip() if pd.notna(row.get('Region', '')) else ''})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} Grain Fumigation")


async def _seed_fss_milling(db, existing_set):
    if 'FSS Grain' in existing_set:
        return
    csv_path = SEED_DIR / 'fss_milling.csv'
    if not csv_path.exists():
        return
    logger.info("Seeding FSS Milling...")
    df = pd.read_csv(csv_path)
    layer_map = {'Grain': 'FSS Grain', 'Flour mills': 'FSS Flour Mills',
                 'Specialty Mills': 'FSS Specialty Mills', 'Mix Plants': 'FSS Mix Plants'}
    points = []
    for _, row in df.iterrows():
        category = str(row['Category']).strip() if pd.notna(row['Category']) else ''
        layer_name = layer_map.get(category)
        if not layer_name:
            continue
        company = str(row['Company Name']).strip() if pd.notna(row['Company Name']) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State_Parsed']).strip() if pd.notna(row['State_Parsed']) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        points.append({'name': company, 'layer': layer_name, 'city': city.title(),
                       'state': state_full, 'lat': geo['lat'], 'lon': geo['lon'],
                       'capacity': str(row.get('Capacity', '')).strip() if pd.notna(row.get('Capacity', '')) else ''})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} FSS Milling points")


async def _seed_grain_terminals(db, existing_set):
    if any('Terminals' in l for l in existing_set):
        return
    xlsx = SEED_DIR / 'grain_terminals.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding Grain Terminals...")

async def _seed_mkc(db, existing_set):
    if 'MKC Grain' in existing_set:
        return
    xlsx = SEED_DIR / 'mkc_locations.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding MKC Locations...")
    df = pd.read_excel(xlsx)
    df = df[df['Location Name'].notna()].head(50)
    agro_col = 'Agromy' if 'Agromy' in df.columns else 'Agronomy'
    points = []
    for _, row in df.iterrows():
        name = str(row['Location Name']).strip()
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        address = str(row.get('Street Address', '')).strip() if pd.notna(row.get('Street Address', '')) else ''
        is_grain = str(row.get('Grain', '')).strip().lower() == 'yes'
        is_agro = str(row.get(agro_col, '')).strip().lower() == 'yes'
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        layers = []
        if is_grain:
            layers.append('MKC Grain')
        if is_agro:
            layers.append('MKC Agronomy')
        if not layers:
            layers.append('MKC Grain')
        for layer in layers:
            points.append({'name': name, 'layer': layer, 'city': city.title(), 'state': state_full,
                           'address': address, 'lat': geo['lat'], 'lon': geo['lon']})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} MKC points")


    df = pd.read_excel(xlsx)
    points = []
    for _, row in df.iterrows():
        commodity = str(row['commodity']).strip() if pd.notna(row['commodity']) else ''
        if not commodity or 'THROUGH PUT' in commodity.upper():
            continue
        if ',' in commodity:
            commodity = commodity.split(',')[0].strip()
        company = str(row['warehouse_company']).strip() if pd.notna(row['warehouse_company']) else ''
        city = str(row['city']).strip() if pd.notna(row['city']) else ''
        state_raw = str(row['state']).strip() if pd.notna(row['state']) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        points.append({'name': company, 'layer': f'Terminals {commodity}', 'city': city.title(),
                       'state': state_full, 'lat': geo['lat'], 'lon': geo['lon'],
                       'commodity': commodity,
                       'capacity': str(row.get('capacity_value', '')).strip() if pd.notna(row.get('capacity_value', '')) else ''})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} Grain Terminal points")


async def _seed_chs(db, existing_set):
    if 'CHS Grain' in existing_set:
        return
    xlsx = SEED_DIR / 'chs_all.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding CHS Locations...")
    df = pd.read_excel(xlsx)
    points = []
    for _, row in df.iterrows():
        name = str(row['Location Name']).strip() if pd.notna(row['Location Name']) else ''
        division = str(row['Division']).strip() if pd.notna(row['Division']) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        address = str(row['Address']).strip() if pd.notna(row['Address']) else ''
        is_grain = str(row.get('Grain', '')).strip().lower() == 'yes'
        is_agro = str(row.get('Agronomy', '')).strip().lower() == 'yes'
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        layers = []
        if is_grain:
            layers.append('CHS Grain')
        if is_agro:
            layers.append('CHS Agronomy')
        if not layers:
            layers.append('CHS Grain')
        for layer in layers:
            points.append({'name': name, 'division': division, 'layer': layer,
                           'city': city.title(), 'state': state_full, 'address': address,
                           'lat': geo['lat'], 'lon': geo['lon']})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} CHS points")



async def _seed_mcgregor(db, existing_set):
    if 'McGregor Locations' in existing_set:
        return
    xlsx = SEED_DIR / 'mcgregor_locations.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding McGregor Locations...")
    df = pd.read_excel(xlsx)
    df = df[df['Location Name'].notna()]
    points = []
    for _, row in df.iterrows():
        name = str(row['Location Name']).strip()
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        address = str(row.get('Street Address', '')).strip() if pd.notna(row.get('Street Address', '')) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        points.append({'name': name, 'layer': 'McGregor Locations', 'city': city.title(),
                       'state': state_full, 'address': address, 'lat': geo['lat'], 'lon': geo['lon']})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} McGregor Locations")


async def _seed_hogs(db):
    """Update 1000+ Hogs density data if current count is too low."""
    """Update 1000+ Hogs density data if current count is too low."""
    count = await db.density_data.count_documents({'layers.1000+ Hogs': {'$exists': True, '$gt': 0}})
    if count >= 800:
        return
    csv_path = SEED_DIR / 'hogs_1000plus.csv'
    if not csv_path.exists():
        return
    logger.info("Seeding 1000+ Hogs density data...")
    df = pd.read_csv(csv_path)
    val_col = [c for c in df.columns if 'INVENTORY' in c.upper() or 'HOG' in c.upper()][0]
    df['State'] = df['State'].str.strip()
    df['County'] = df['County'].str.strip().str.upper()
    grouped = df.groupby(['State', 'County'])[val_col].sum().reset_index()
    updated = 0
    for _, row in grouped.iterrows():
        state = row['State'].strip()
        county = row['County'].strip().upper()
        value = int(row[val_col])
        doc = await db.density_data.find_one({
            'county': county,
            '$or': [{'state': state}, {'state': state.upper()}, {'state': state.title()}]
        })
        if doc:
            await db.density_data.update_one({'_id': doc['_id']}, {'$set': {'layers.1000+ Hogs': value}})
            updated += 1
    logger.info(f"Seeded {updated} counties with 1000+ Hogs data")
