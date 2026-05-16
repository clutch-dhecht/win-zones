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

CANADA_CITIES = [
    # City, Province (full name), Latitude, Longitude — augment for Molson Coors and similar
    ('Toronto', 'Ontario', 43.6532, -79.3832),
    ('Montreal', 'Quebec', 45.5017, -73.5673),
    ('Vancouver', 'British Columbia', 49.2827, -123.1207),
    ('Calgary', 'Alberta', 51.0447, -114.0719),
    ('Edmonton', 'Alberta', 53.5461, -113.4938),
    ('Winnipeg', 'Manitoba', 49.8951, -97.1384),
    ('Ottawa', 'Ontario', 45.4215, -75.6972),
    ('Quebec City', 'Quebec', 46.8139, -71.2080),
    ('Hamilton', 'Ontario', 43.2557, -79.8711),
    ('Halifax', 'Nova Scotia', 44.6488, -63.5752),
    ('London', 'Ontario', 42.9849, -81.2453),
    ('Kitchener', 'Ontario', 43.4516, -80.4925),
    ('Mississauga', 'Ontario', 43.5890, -79.6441),
    ('Brampton', 'Ontario', 43.7315, -79.7624),
    ('Saskatoon', 'Saskatchewan', 52.1332, -106.6700),
    ('Regina', 'Saskatchewan', 50.4452, -104.6189),
    ('St. John\'s', 'Newfoundland and Labrador', 47.5615, -52.7126),
    ('Moncton', 'New Brunswick', 46.0878, -64.7782),
    ('Creemore', 'Ontario', 44.3239, -80.1056),  # Molson Coors craft brewery
    ('Toronto-Etobicoke', 'Ontario', 43.6205, -79.5132),  # Molson Coors brewery
    ('Chambly', 'Quebec', 45.4533, -73.2856),
    ('Longueuil', 'Quebec', 45.5312, -73.5184),
    ('Saint-Hubert', 'Quebec', 45.4880, -73.4180),
    ('Chilliwack', 'British Columbia', 49.1579, -121.9514),
    ('Shawinigan', 'Quebec', 46.5667, -72.7500),
]

PROVINCE_ABBREV = {
    'AB': 'Alberta','BC': 'British Columbia','MB': 'Manitoba','NB': 'New Brunswick',
    'NL': 'Newfoundland and Labrador','NS': 'Nova Scotia','NT': 'Northwest Territories',
    'NU': 'Nunavut','ON': 'Ontario','PE': 'Prince Edward Island','QC': 'Quebec',
    'SK': 'Saskatchewan','YT': 'Yukon',
}


def _load_cities():
    global US_CITIES_DF
    if US_CITIES_DF is None:
        csv_path = Path(__file__).parent / 'us_cities_coordinates.csv'
        US_CITIES_DF = pd.read_csv(csv_path)
        US_CITIES_DF['CITY_UPPER'] = US_CITIES_DF['CITY'].str.upper()
        US_CITIES_DF['STATE_UPPER'] = US_CITIES_DF['STATE_NAME'].str.upper()
        # Append Canada augment
        ca_rows = []
        next_id = int(US_CITIES_DF['ID'].max()) + 1 if 'ID' in US_CITIES_DF.columns else 100000
        for city, province, lat, lon in CANADA_CITIES:
            ca_rows.append({
                'ID': next_id, 'STATE_CODE': '', 'STATE_NAME': province, 'CITY': city,
                'COUNTY': '', 'LATITUDE': lat, 'LONGITUDE': lon,
                'CITY_UPPER': city.upper(), 'STATE_UPPER': province.upper(),
            })
            next_id += 1
        US_CITIES_DF = pd.concat([US_CITIES_DF, pd.DataFrame(ca_rows)], ignore_index=True)
    return US_CITIES_DF

_geocode_cache = {}

def _normalize_city(city):
    """Generate progressively-relaxed variants of a city name for matching."""
    c = re.sub(r'^(elevator|port|terminal)\s+', '', city, flags=re.IGNORECASE).strip()
    # Strip diacritics roughly (Montréal -> Montreal)
    try:
        import unicodedata
        c = ''.join(ch for ch in unicodedata.normalize('NFD', c) if unicodedata.category(ch) != 'Mn')
    except Exception:
        pass
    yield c.upper()
    # Strip parenthetical content: "Bakersfield (Mettler)" -> "Bakersfield"
    no_paren = re.sub(r'\s*\([^)]*\)\s*', '', c).strip()
    if no_paren and no_paren != c:
        yield no_paren.upper()
        c = no_paren
    # Saint/St variants
    base = c.upper()
    for swap in [('ST.', 'SAINT'), ('ST ', 'SAINT '),
                 ('MT.', 'MOUNT'), ('MT ', 'MOUNT '),
                 ('SAINT-', 'SAINT '), ('-', ' ')]:
        v = base.replace(swap[0], swap[1])
        if v != base:
            yield v
    # Take only the part before any " - " separator
    if ' - ' in c:
        yield c.split(' - ')[0].strip().upper()


def _geocode(city, state_full):
    df = _load_cities()
    cache_key = f"{str(city).strip().upper()},{state_full.upper()}"
    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]
    state_upper = state_full.upper().strip()
    seen = set()
    for variant in _normalize_city(city):
        if variant in seen:
            continue
        seen.add(variant)
        # Exact (city + state) match
        matches = df[(df['CITY_UPPER'] == variant) & (df['STATE_UPPER'] == state_upper)]
        if not matches.empty:
            row = matches.iloc[0]
            coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
            _geocode_cache[cache_key] = coords
            return coords
    # Last-resort: city anywhere
    for variant in seen:
        matches = df[df['CITY_UPPER'] == variant]
        if not matches.empty:
            row = matches.iloc[0]
            coords = {'lat': float(row['LATITUDE']), 'lon': float(row['LONGITUDE'])}
            _geocode_cache[cache_key] = coords
            return coords
    _geocode_cache[cache_key] = None
    return None

def _to_state_full(raw):
    raw = str(raw).strip()
    if not raw or raw.lower() == 'nan':
        return ''
    upper = raw.upper()
    if len(raw) == 2:
        return ABBREV_TO_STATE.get(upper) or PROVINCE_ABBREV.get(upper) or raw
    return raw


async def seed_all(db):
    """Run all seed checks. Only imports data if the layer is missing."""
    try:
        # One-time migration: rename "CLS Customer Head Sheds" -> "CLS Customer Locations"
        legacy_cls = await db.location_points.count_documents({'layer': 'CLS Customer Head Sheds'})
        if legacy_cls > 0:
            await db.location_points.update_many(
                {'layer': 'CLS Customer Head Sheds'},
                {'$set': {'layer': 'CLS Customer Locations'}},
            )
            logger.info(f"Migrated {legacy_cls} CLS Customer Head Sheds -> CLS Customer Locations")

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
        await _seed_nutrien(db, existing_set)
        await _seed_rice_commercial(db, existing_set)
        await _seed_simplot(db, existing_set)
        await _seed_abm_locations(db, existing_set)
        await _seed_hogs(db)
        await _dedup_cleanup(db)

        logger.info("Seed check complete")
    except Exception as e:
        logger.error(f"Seed error: {e}")


async def _seed_cls_customers(db, existing_set):
    if 'CLS Customer Locations' in existing_set:
        count = await db.location_points.count_documents({'layer': 'CLS Customer Locations'})
        if count > 500:
            return
    xlsx = SEED_DIR / 'cls_customers.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding CLS Customer Locations...")
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
                       'layer': 'CLS Customer Locations', 'city': city.title(), 'state': state_full,
                       'lat': geo['lat'], 'lon': geo['lon']})
    await db.location_points.delete_many({'layer': 'CLS Customer Locations'})
    # Also clean legacy point_data/city_data
    await db.point_data.delete_many({})
    await db.city_data.delete_many({})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} CLS Customer Locations")


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
        count = await db.location_points.count_documents({'layer': 'McGregor Locations'})
        if count >= 25:
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
        await db.location_points.delete_many({'layer': 'McGregor Locations'})
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} McGregor Locations")


async def _seed_nutrien(db, existing_set):
    # RETIRED: The legacy single-layer "Nutrien Locations" was replaced by the
    # 4-tier Nutrien Retail/Terminal/Storage/Office split when the ABM workbook
    # landed (PR #4). Re-seeding it would just create cross-layer duplicates
    # the dedup pass has to clean up on every restart. Guard: if any of the
    # new Nutrien sub-layers exist, skip the legacy import entirely.
    new_nutrien_count = await db.location_points.count_documents({
        'layer': {'$in': ['Nutrien Retail', 'Nutrien Terminal', 'Nutrien Storage', 'Nutrien Office']}
    })
    if new_nutrien_count > 0:
        # Also clean up any stale legacy "Nutrien Locations" rows that may exist
        legacy = await db.location_points.count_documents({'layer': 'Nutrien Locations'})
        if legacy > 0:
            await db.location_points.delete_many({'layer': 'Nutrien Locations'})
            logger.info(f"Cleaned {legacy} legacy 'Nutrien Locations' records (replaced by Nutrien sub-layers)")
        return

    if 'Nutrien Locations' in existing_set:
        count = await db.location_points.count_documents({'layer': 'Nutrien Locations'})
        if count >= 50:
            return
    csv_path = SEED_DIR / 'nutrien_locations.csv'
    if not csv_path.exists():
        return
    logger.info("Seeding Nutrien Locations...")
    df = pd.read_csv(csv_path)
    points = []
    for _, row in df.iterrows():
        name = str(row['Location Name']).strip() if pd.notna(row['Location Name']) else ''
        loc_type = str(row.get('Type', '')).strip() if pd.notna(row.get('Type', '')) else ''
        address = str(row.get('Address', '')).strip() if pd.notna(row.get('Address', '')) else ''
        city = str(row['City']).strip() if pd.notna(row['City']) else ''
        state_raw = str(row['State']).strip() if pd.notna(row['State']) else ''
        zip_code = str(row.get('Zip', '')).strip() if pd.notna(row.get('Zip', '')) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        geo = _geocode(city, state_full)
        if not geo:
            continue
        points.append({'name': name, 'layer': 'Nutrien Locations', 'type': loc_type,
                       'address': address, 'city': city.title(), 'state': state_full,
                       'zip': zip_code, 'lat': geo['lat'], 'lon': geo['lon']})
    if points:
        await db.location_points.delete_many({'layer': 'Nutrien Locations'})
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} Nutrien Locations")


async def _seed_simplot(db, existing_set):
    """Seed Simplot location points from mp_Simplot_Locations.xlsx.

    195 rows in source (177 US + 18 Canada). Only US locations are seeded —
    Canadian pins would render as dead dots when Rice market (no state filter)
    is selected.
    """
    if 'Simplot' in existing_set:
        count = await db.location_points.count_documents({'layer': 'Simplot'})
        if count >= 150:
            return
    xlsx_path = SEED_DIR / 'simplot_locations.xlsx'
    if not xlsx_path.exists():
        return
    logger.info("Seeding Simplot Locations...")
    df = pd.read_excel(xlsx_path)
    points = []
    for _, row in df.iterrows():
        country = str(row.get('Country', '')).strip() if pd.notna(row.get('Country')) else ''
        if country and country.upper() not in ('USA', 'US', 'UNITED STATES'):
            continue  # US-only — skip Canada
        branch = str(row.get('Branch Name', '')).strip() if pd.notna(row.get('Branch Name')) else ''
        address = str(row.get('Street', '')).strip() if pd.notna(row.get('Street')) else ''
        city = str(row.get('City', '')).strip() if pd.notna(row.get('City')) else ''
        state_raw = str(row.get('State/Prov', '')).strip() if pd.notna(row.get('State/Prov')) else ''
        zip_code = str(row.get('Zip/Postal', '')).strip() if pd.notna(row.get('Zip/Postal')) else ''
        phone = str(row.get('Phone', '')).strip() if pd.notna(row.get('Phone')) else ''
        if not city or not state_raw:
            continue
        state_full = _to_state_full(state_raw)
        if not state_full:
            continue
        geo = _geocode(city, state_full)
        if not geo:
            logger.warning(f"Simplot: could not geocode {city}, {state_full}")
            continue
        doc = {
            'name': branch or 'Simplot', 'layer': 'Simplot',
            'city': city.title(), 'state': state_full,
            'lat': geo['lat'], 'lon': geo['lon'],
        }
        if address: doc['address'] = address
        if zip_code: doc['zip'] = zip_code
        if phone: doc['phone'] = phone
        points.append(doc)
    if points:
        await db.location_points.delete_many({'layer': 'Simplot'})
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} Simplot points")


async def _seed_rice_commercial(db, existing_set):
    rice_layers = {'Riceland Co-op', 'Supreme Rice', 'Producers Rice Mill'}
    if rice_layers.issubset(existing_set):
        count = await db.location_points.count_documents({'layer': {'$in': list(rice_layers)}})
        if count >= 30:
            return
    xlsx = SEED_DIR / 'rice_commercial.xlsx'
    if not xlsx.exists():
        return
    logger.info("Seeding Rice Commercial...")
    df = pd.read_excel(xlsx)
    points = []
    for _, row in df.iterrows():
        coop = str(row['Co-op']).strip() if pd.notna(row['Co-op']) else ''
        city_state = str(row['City/State']).strip() if pd.notna(row['City/State']) else ''
        if not coop or ',' not in city_state:
            continue
        city_part, state_part = [p.strip() for p in city_state.split(',', 1)]
        # Fix known typos in source data
        typo_fixes = {'suttgart': 'Stuttgart', 'wynee': 'Wynne'}
        if city_part.lower() in typo_fixes:
            city_part = typo_fixes[city_part.lower()]
        state_full = _to_state_full(state_part)
        geo = _geocode(city_part, state_full)
        if not geo:
            logger.warning(f"Rice Commercial: could not geocode {city_part}, {state_full}")
            continue
        points.append({'name': coop, 'layer': coop, 'city': city_part.title(),
                       'state': state_full, 'lat': geo['lat'], 'lon': geo['lon']})
    if points:
        await db.location_points.delete_many({'layer': {'$in': list(rice_layers)}})
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} Rice Commercial points")


NUTRIEN_TYPE_TO_LAYER = {
    'RetailBranch': 'Nutrien Retail',
    'CommissionedAgent': 'Nutrien Retail',
    'Commission Whse': 'Nutrien Retail',
    'Terminal': 'Nutrien Terminal',
    'Storage': 'Nutrien Storage',
    'DivisionStorage': 'Nutrien Storage',
    'Tank': 'Nutrien Storage',
    'SeedStorage': 'Nutrien Storage',
    'DistributionCenter': 'Nutrien Storage',
    'DivisionOffice': 'Nutrien Office',
    'Department': 'Nutrien Office',
}
NUTRIEN_DEFAULT_LAYER = 'Nutrien Retail'
ABM_LAYERS = {
    'Poinsett Rice & Grain', 'Farmers Rice', 'Triton Fumigation',
    'Aurora Coop', 'Wilbur-Ellis', 'Helena Agri', 'Skyland Grain', 'Molson Coors',
    'Nutrien Retail', 'Nutrien Terminal', 'Nutrien Storage', 'Nutrien Office',
}


async def _seed_abm_locations(db, existing_set):
    """Seed the CLS ABM Locations workbook (9 sheets, ~1700 records).

    The 'Nutrien' sheet replaces any prior 'Nutrien Locations' layer and is split
    by Type column into sub-layers (Retail/Terminal/Storage/Office). The other
    sheets each become their own layer.
    """
    xlsx_path = SEED_DIR / 'cls_abm_locations.xlsx'
    if not xlsx_path.exists():
        return

    # Idempotency: skip if total ABM layer count is already in the expected range
    existing_count = await db.location_points.count_documents({'layer': {'$in': list(ABM_LAYERS)}})
    if existing_count >= 1500:
        return

    logger.info("Seeding CLS ABM Locations...")
    xl = pd.ExcelFile(xlsx_path)
    points = []

    def grab(row, *candidates):
        for c in candidates:
            if c in row.index and pd.notna(row[c]) and str(row[c]).strip().lower() != 'nan':
                v = str(row[c]).strip()
                if v:
                    return v
        return ''

    for sheet in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet)
        for _, row in df.iterrows():
            location = grab(row, 'Location', 'Location Name')
            branch = grab(row, 'Branch', 'Branch Name', 'Office')
            address = grab(row, 'Street')
            city = grab(row, 'City')
            state_raw = grab(row, 'State', 'State/Province')
            zip_code = grab(row, 'Zip', 'Postal')
            phone = grab(row, 'Phone')
            type_val = grab(row, 'Type')
            country = grab(row, 'Country')

            if not city or not state_raw:
                continue
            state_full = _to_state_full(state_raw)
            if not state_full:
                continue
            geo = _geocode(city, state_full)
            if not geo:
                logger.warning(f"ABM: could not geocode {city}, {state_full} (sheet={sheet})")
                continue

            # Pick the layer
            if sheet == 'Nutrien':
                layer = NUTRIEN_TYPE_TO_LAYER.get(type_val, NUTRIEN_DEFAULT_LAYER)
            elif sheet == 'Skyland Grain':
                layer = 'Skyland Grain'
            else:
                layer = sheet.strip()

            doc = {
                'name': branch or location, 'layer': layer,
                'city': city.title(), 'state': state_full,
                'lat': geo['lat'], 'lon': geo['lon'],
            }
            if address: doc['address'] = address
            if zip_code: doc['zip'] = zip_code
            if phone: doc['phone'] = phone
            if type_val: doc['type'] = type_val
            if country: doc['country'] = country
            if branch and location and branch != location:
                doc['location_group'] = location  # parent company name
            points.append(doc)

    # Replace ABM layers and the prior Nutrien Locations layer
    await db.location_points.delete_many({'layer': {'$in': list(ABM_LAYERS) + ['Nutrien Locations']}})
    if points:
        await db.location_points.insert_many(points)
    logger.info(f"Seeded {len(points)} ABM location points across {len(xl.sheet_names)} sheets")


async def _seed_hogs(db):
    """Seed/refresh 1000+ Hogs density data. Re-seeds when DB total != CSV total."""
    csv_path = SEED_DIR / 'hogs_1000plus.csv'
    if not csv_path.exists():
        return
    df = pd.read_csv(csv_path)
    val_col = [c for c in df.columns if 'INVENTORY' in c.upper() or 'HOG' in c.upper()][0]
    df['State'] = df['State'].str.strip()
    df['County'] = df['County'].str.strip().str.upper()
    grouped = df.groupby(['State', 'County'])[val_col].sum().reset_index()
    csv_total = int(grouped[val_col].sum())

    pipeline = [
        {'$match': {'layers.1000+ Hogs': {'$exists': True, '$gt': 0}}},
        {'$group': {'_id': None, 'total': {'$sum': '$layers.1000+ Hogs'}}},
    ]
    agg = await db.density_data.aggregate(pipeline).to_list(length=1)
    db_total = int(agg[0]['total']) if agg else 0
    if db_total == csv_total:
        return

    logger.info(f"Seeding 1000+ Hogs density data (db_total={db_total}, csv_total={csv_total})...")
    upserted = 0
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
        else:
            await db.density_data.insert_one({
                'state': state.title(),
                'county': county,
                'layers': {'1000+ Hogs': value},
            })
        upserted += 1
    logger.info(f"Seeded {upserted} counties with 1000+ Hogs data")


# ─── DEDUP CLEANUP ─────────────────────────────────────────────────────────
# Runtime dedup pass — runs on every backend startup but is idempotent: once
# duplicates have been removed it produces zero further drops. Drops are
# logged to the `deleted_dupes_audit` collection BEFORE deletion so the operation
# is reversible. See data_exports/DUPLICATES_DELETIONS_PROPOSED.xlsx for the
# rules and headline counts that were sanity-checked before deploy.

DEDUP_LAYER_PRIO = {
    'CLS Customer Locations': 0,
    'Nutrien Retail': 1, 'Nutrien Terminal': 1, 'Nutrien Storage': 1, 'Nutrien Office': 1,
    'Skyland Grain': 1, 'Helena Agri': 1, 'Wilbur-Ellis': 1, 'Aurora Coop': 1,
    'MKC Grain': 1, 'CHS Grain': 1, 'McGregor Locations': 1,
    'Riceland Co-op': 1, 'Supreme Rice': 1, 'Producers Rice Mill': 1,
    'Poinsett Rice & Grain': 1, 'Farmers Rice': 1, 'Triton Fumigation': 1,
    'Molson Coors': 1,
    'CHS Agronomy': 2, 'MKC Agronomy': 2,
    'Terminals SRW Wheat': 2, 'Terminals HRW Wheat': 2, 'Terminals HRS Wheat': 2,
    'Terminals Rough Rice': 2, 'Terminals Corn & Soybean': 2,
    'Terminals Soybean Oil': 2, 'Terminals Soybean Meal': 2, 'Terminals Oats': 2,
    'FSS Grain': 3, 'FSS Flour Mills': 3, 'FSS Specialty Mills': 3, 'FSS Mix Plants': 3,
    'Grain Elevators': 4,
    'Grain Fumigation': 5,
    'Feed Manufacturers': 6,
    'Feed Stores': 7,
    'Pest Control': 8,
}
DEDUP_DEFAULT_PRIO = 99

DEDUP_EXPECTED_CO = {
    frozenset(['CHS Grain', 'CHS Agronomy']),
    frozenset(['MKC Grain', 'MKC Agronomy']),
    frozenset(['Nutrien Retail', 'Nutrien Terminal']),
    frozenset(['Nutrien Retail', 'Nutrien Storage']),
    frozenset(['Nutrien Retail', 'Nutrien Office']),
    frozenset(['Nutrien Terminal', 'Nutrien Storage']),
    frozenset(['Nutrien Terminal', 'Nutrien Office']),
    frozenset(['Nutrien Storage', 'Nutrien Office']),
}


def _dedup_norm_addr(s):
    if not s:
        return ''
    s = str(s).upper().strip()
    for a, b in [('STREET', 'ST'), ('AVENUE', 'AVE'), ('ROAD', 'RD'), ('HIGHWAY', 'HWY'),
                 ('BOULEVARD', 'BLVD'), ('DRIVE', 'DR'), ('LANE', 'LN'), ('COURT', 'CT'),
                 ('NORTH', 'N'), ('SOUTH', 'S'), ('EAST', 'E'), ('WEST', 'W')]:
        s = re.sub(rf'\b{a}\b', b, s)
    return re.sub(r'\s+', ' ', re.sub(r'[.,]', '', s)).strip()


def _dedup_tokens(s):
    return set(t for t in re.sub(r'[^A-Z0-9]+', ' ', str(s or '').upper()).split() if len(t) >= 2)


def _dedup_jaccard(a, b):
    sa, sb = _dedup_tokens(a), _dedup_tokens(b)
    if not sa or not sb:
        return 0
    return len(sa & sb) / max(len(sa | sb), 1)


def _dedup_completeness(p):
    return sum(1 for v in p.values() if v not in (None, '', 'nan'))


async def _dedup_cleanup(db):
    """Drop duplicate location_points using a priority ladder + same-name rule.

    Rules (per user spec):
      - CLS Customer Locations is priority 0 — always wins
      - Key-account layers (Nutrien*, Skyland, Helena, Wilbur-Ellis, Aurora,
        MKC Grain, CHS Grain, McGregor, rice co-ops, Molson Coors) priority 1
      - Terminals + CHS/MKC Agronomy priority 2
      - FSS variants priority 3
      - Grain Elevators 4, Fumigation 5, Feed Mfrs 6, Feed Stores 7, Pest Control 8
      - Same address + different company names → KEEP BOTH (no drop)
      - Intra-layer dupes (similar names + same address) → keep most-complete
      - Expected multi-classifications (CHS Grain+Agronomy, MKC Grain+Agronomy,
        Nutrien sub-types) → never deduped
    """
    from collections import defaultdict
    from datetime import datetime, timezone

    NAME_INTRA_THRESHOLD = 0.7
    NAME_CROSS_THRESHOLD = 0.5

    all_points = await db.location_points.find({}).to_list(length=None)
    groups = defaultdict(list)
    for p in all_points:
        addr_n = _dedup_norm_addr(p.get('address') or '')
        city_n = (p.get('city') or '').strip().upper()
        state_n = (p.get('state') or '').strip().upper()
        if addr_n and city_n and state_n:
            p['_addr_n'] = addr_n
            p['_city_n'] = city_n
            p['_state_n'] = state_n
            p['_name_for_match'] = p.get('name') or p.get('customer_name') or ''
            p['_complete'] = _dedup_completeness(p)
            groups[(city_n, state_n, addr_n)].append(p)

    to_drop_ids = set()
    drop_log = []

    for key, items in groups.items():
        if len(items) < 2:
            continue
        by_layer = defaultdict(list)
        for p in items:
            by_layer[p['layer']].append(p)

        # Intra-layer pass
        for layer, lst in by_layer.items():
            if len(lst) < 2:
                continue
            clusters = []
            for p in lst:
                placed = False
                for cl in clusters:
                    if _dedup_jaccard(p['_name_for_match'], cl[0]['_name_for_match']) >= NAME_INTRA_THRESHOLD:
                        cl.append(p)
                        placed = True
                        break
                if not placed:
                    clusters.append([p])
            for cl in clusters:
                if len(cl) < 2:
                    continue
                cl.sort(key=lambda p: (-p['_complete'], -len(p.get('name') or '')))
                winner = cl[0]
                for loser in cl[1:]:
                    if loser['_id'] in to_drop_ids:
                        continue
                    to_drop_ids.add(loser['_id'])
                    drop_log.append({
                        'dropped_id': loser['_id'], 'dropped_layer': loser.get('layer'),
                        'dropped_name': loser.get('name', ''),
                        'dropped_city': loser.get('city', ''), 'dropped_state': loser.get('state', ''),
                        'dropped_address': loser.get('address', ''),
                        'tier': 'T1-intra',
                        'winner_id': winner['_id'], 'winner_layer': winner.get('layer'),
                        'winner_name': winner.get('name', ''),
                        'reason': f"Same layer ({layer}), similar name, same address — kept most-complete",
                        'dropped_record': {k: v for k, v in loser.items() if not k.startswith('_')},
                    })

        # Cross-layer pass — one canonical record per layer at this address
        canonical = {layer: max(lst, key=lambda p: p['_complete']) for layer, lst in by_layer.items()}
        layers_here = list(canonical.keys())
        for i in range(len(layers_here)):
            for j in range(i + 1, len(layers_here)):
                la, lb = layers_here[i], layers_here[j]
                if frozenset([la, lb]) in DEDUP_EXPECTED_CO:
                    continue
                a, b = canonical[la], canonical[lb]
                if _dedup_jaccard(a['_name_for_match'], b['_name_for_match']) < NAME_CROSS_THRESHOLD:
                    continue  # different businesses at same address — keep both
                pa = DEDUP_LAYER_PRIO.get(la, DEDUP_DEFAULT_PRIO)
                pb = DEDUP_LAYER_PRIO.get(lb, DEDUP_DEFAULT_PRIO)
                if pa == pb:
                    continue
                winner_layer = la if pa < pb else lb
                loser_layer = lb if winner_layer == la else la
                winner_rec = canonical[winner_layer]
                for loser in by_layer[loser_layer]:
                    if loser['_id'] in to_drop_ids:
                        continue
                    to_drop_ids.add(loser['_id'])
                    drop_log.append({
                        'dropped_id': loser['_id'], 'dropped_layer': loser.get('layer'),
                        'dropped_name': loser.get('name', ''),
                        'dropped_city': loser.get('city', ''), 'dropped_state': loser.get('state', ''),
                        'dropped_address': loser.get('address', ''),
                        'tier': 'T3-cross',
                        'winner_id': winner_rec['_id'], 'winner_layer': winner_rec.get('layer'),
                        'winner_name': winner_rec.get('name', ''),
                        'reason': f"Cross-layer same-address (prio {DEDUP_LAYER_PRIO.get(winner_layer)} {winner_layer} beats prio {DEDUP_LAYER_PRIO.get(loser_layer)} {loser_layer})",
                        'dropped_record': {k: v for k, v in loser.items() if not k.startswith('_')},
                    })

    # ─── T4 pass: same company + same city, different/missing addresses ───
    # For each (normalized_company, city, state) group:
    #   - Bucket real-address records by numeric-fuzzy address match
    #     ("332 AR-212" ≡ "332 Hwy. 212 E.")
    #   - Records within a bucket → same physical facility (dedup, intra-layer or cross)
    #   - No-real-address records (empty or P.O. Box only):
    #     * If exactly one address bucket exists → pair with it
    #     * If multiple address buckets → ambiguous, skip
    # CLS Customer Locations is excluded (customer_name distinguishes records that
    # share name+city+state — same ship-to, different customers).
    PO_BOX_RE = re.compile(r'\b(P\s*\.?\s*O\s*\.?\s*BOX|POBOX|PO\s*BOX)\b', re.IGNORECASE)

    def _is_real_addr(a):
        if not a or not str(a).strip(): return False
        s = str(a).strip()
        if PO_BOX_RE.match(s): return False
        if PO_BOX_RE.search(s) and len(s) < 30: return False
        return True

    def _addr_num_key(a):
        nums = re.findall(r'\d+', str(a or ''))
        return tuple(sorted(int(n) for n in nums if len(n) >= 2))

    def _addr_fuzzy_match(a, b):
        ka, kb = _addr_num_key(a), _addr_num_key(b)
        return ka and kb and ka == kb

    def _norm_company(name):
        if not name: return ''
        s = re.sub(r'[^A-Za-z0-9 ]+', ' ', str(name))
        s = re.sub(r'\s+', ' ', s).strip().upper()
        for suf in (' INCORPORATED', ' INC', ' LLC', ' LP', ' LLP',
                    ' CORP', ' CORPORATION', ' CO', ' COMPANY'):
            if s.endswith(suf):
                s = s[:-len(suf)].strip()
        return s

    # Re-fetch the (possibly shrunk) point set after T1/T3 drops
    remaining_ids = set(p['_id'] for p in all_points) - to_drop_ids
    remaining = [p for p in all_points if p['_id'] in remaining_ids and p.get('layer') != 'CLS Customer Locations']

    t4_groups = defaultdict(list)
    for p in remaining:
        c = _norm_company(p.get('name') or '')
        city = (p.get('city') or '').strip().upper()
        state = (p.get('state') or '').strip().upper()
        if c and city and state:
            t4_groups[(c, city, state)].append(p)

    # Track address merges to apply to winners (winner_id -> address_to_set)
    addr_merges = {}

    for (company, city, state), items in t4_groups.items():
        if len(items) < 2:
            continue
        real_items = [p for p in items if _is_real_addr(p.get('address'))]
        no_real_items = [p for p in items if not _is_real_addr(p.get('address'))]

        facility_buckets = []
        for p in real_items:
            placed = False
            for bucket in facility_buckets:
                if _addr_fuzzy_match(bucket[0].get('address'), p.get('address')):
                    bucket.append(p)
                    placed = True
                    break
            if not placed:
                facility_buckets.append([p])

        # Intra-bucket dedup (same physical place)
        for bucket in facility_buckets:
            if len(bucket) < 2:
                continue
            bucket.sort(key=lambda p: (DEDUP_LAYER_PRIO.get(p['layer'], DEDUP_DEFAULT_PRIO),
                                       -_dedup_completeness(p)))
            winner = bucket[0]
            for loser in bucket[1:]:
                if loser['_id'] in to_drop_ids:
                    continue
                if frozenset([winner['layer'], loser['layer']]) in DEDUP_EXPECTED_CO:
                    continue
                to_drop_ids.add(loser['_id'])
                drop_log.append({
                    'dropped_id': loser['_id'], 'dropped_layer': loser.get('layer'),
                    'dropped_name': loser.get('name', ''),
                    'dropped_city': loser.get('city', ''), 'dropped_state': loser.get('state', ''),
                    'dropped_address': loser.get('address', ''),
                    'tier': 'T4-same-facility',
                    'winner_id': winner['_id'], 'winner_layer': winner.get('layer'),
                    'winner_name': winner.get('name', ''),
                    'reason': f"Same company ({company}) at same physical address (numeric-fuzzy), {city} {state}",
                    'dropped_record': {k: v for k, v in loser.items() if not k.startswith('_')},
                })

        # No-real records
        if no_real_items:
            if len(facility_buckets) == 0:
                sorted_nr = sorted(no_real_items,
                                   key=lambda p: (DEDUP_LAYER_PRIO.get(p['layer'], DEDUP_DEFAULT_PRIO),
                                                  -_dedup_completeness(p)))
                winner = sorted_nr[0]
                for loser in sorted_nr[1:]:
                    if loser['_id'] in to_drop_ids: continue
                    if frozenset([winner['layer'], loser['layer']]) in DEDUP_EXPECTED_CO: continue
                    to_drop_ids.add(loser['_id'])
                    drop_log.append({
                        'dropped_id': loser['_id'], 'dropped_layer': loser.get('layer'),
                        'dropped_name': loser.get('name', ''),
                        'dropped_city': loser.get('city', ''), 'dropped_state': loser.get('state', ''),
                        'dropped_address': loser.get('address', ''),
                        'tier': 'T4-no-address',
                        'winner_id': winner['_id'], 'winner_layer': winner.get('layer'),
                        'winner_name': winner.get('name', ''),
                        'reason': f"Same company ({company}), no real address on either side, {city} {state}",
                        'dropped_record': {k: v for k, v in loser.items() if not k.startswith('_')},
                    })
            elif len(facility_buckets) == 1:
                bucket = facility_buckets[0]
                sb = sorted(bucket, key=lambda p: (DEDUP_LAYER_PRIO.get(p['layer'], DEDUP_DEFAULT_PRIO),
                                                   -_dedup_completeness(p)))
                for nr in no_real_items:
                    contenders = sb + [nr]
                    contenders.sort(key=lambda p: (DEDUP_LAYER_PRIO.get(p['layer'], DEDUP_DEFAULT_PRIO),
                                                   -_dedup_completeness(p)))
                    winner = contenders[0]
                    loser = nr if winner['_id'] != nr['_id'] else sb[0]
                    if winner['_id'] == loser['_id']: continue
                    if loser['_id'] in to_drop_ids: continue
                    if frozenset([winner['layer'], loser['layer']]) in DEDUP_EXPECTED_CO: continue
                    merge_addr = None
                    if not _is_real_addr(winner.get('address')) and _is_real_addr(loser.get('address')):
                        merge_addr = loser.get('address')
                        # Only set if winner doesn't already have a pending real address from another merge
                        if winner['_id'] not in addr_merges:
                            addr_merges[winner['_id']] = merge_addr
                    to_drop_ids.add(loser['_id'])
                    drop_log.append({
                        'dropped_id': loser['_id'], 'dropped_layer': loser.get('layer'),
                        'dropped_name': loser.get('name', ''),
                        'dropped_city': loser.get('city', ''), 'dropped_state': loser.get('state', ''),
                        'dropped_address': loser.get('address', ''),
                        'tier': 'T4-no-real-paired',
                        'winner_id': winner['_id'], 'winner_layer': winner.get('layer'),
                        'winner_name': winner.get('name', ''),
                        'reason': f"Same company ({company}) in {city} {state}; no-address paired with single facility",
                        'dropped_record': {k: v for k, v in loser.items() if not k.startswith('_')},
                    })
            # else: multiple real-address buckets + no-real → AMBIGUOUS, leave alone

    if not drop_log:
        return  # idempotent — nothing to do

    # Deduplicate drop_log by dropped_id (a record might be flagged by multiple paths)
    seen_log_ids = set()
    unique_log = []
    for entry in drop_log:
        rid = entry['dropped_id']
        if rid in seen_log_ids:
            continue
        seen_log_ids.add(rid)
        unique_log.append(entry)
    drop_log = unique_log

    # Only keep entries for records that still exist in the collection
    # (guards against archiving phantom IDs across restart cascades)
    existing_cursor = db.location_points.find(
        {'_id': {'$in': list(to_drop_ids)}}, {'_id': 1}
    )
    existing_ids = {doc['_id'] async for doc in existing_cursor}
    drop_log = [e for e in drop_log if e['dropped_id'] in existing_ids]
    to_drop_ids = existing_ids

    if not drop_log:
        return  # everything already gone

    # Apply address merges first (so the winners keep the inherited address)
    for winner_id, addr in addr_merges.items():
        if winner_id in to_drop_ids:
            continue  # winner is itself being dropped — skip
        await db.location_points.update_one(
            {'_id': winner_id},
            {'$set': {'address': addr}},
        )

    # Archive before deletion (reversibility net)
    timestamp = datetime.now(timezone.utc).isoformat()
    for entry in drop_log:
        entry['archived_at'] = timestamp
    await db.deleted_dupes_audit.insert_many(drop_log)
    result = await db.location_points.delete_many({'_id': {'$in': list(to_drop_ids)}})
    logger.info(f"Dedup cleanup: archived + deleted {result.deleted_count} duplicate location_points "
                f"({len(addr_merges)} winners gained an address)")
