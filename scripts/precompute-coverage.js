#!/usr/bin/env node
/**
 * Precompute Coverage Radius results for ABM market presets.
 *
 * Reads data_exports/location_points.csv + density_data.csv, runs the same
 * locality-aware coverage math the frontend uses, and writes results to
 * frontend/src/data/precomputed-coverage.json so the app can serve them
 * instantly on first paint (no waiting for the in-browser compute).
 *
 * Usage:
 *   cd frontend
 *   node ../scripts/precompute-coverage.js
 *
 * Re-run any time the underlying data exports change.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { MongoClient } = require(path.join(__dirname, 'node_modules/mongodb'));

const REPO_ROOT = path.resolve(__dirname, '..');
const COUNTIES_GEOJSON_URL = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';
const COUNTIES_CACHE = path.join(__dirname, '.cache-counties.json');
const OUT_PATH = path.join(REPO_ROOT, 'frontend/src/data/precomputed-coverage.json');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'winzones';

// Use the frontend's turf packages
const FRONTEND_NODE_MODULES = path.join(REPO_ROOT, 'frontend/node_modules');
const requireFE = (mod) => require(path.join(FRONTEND_NODE_MODULES, mod));
const { circle } = requireFE('@turf/circle');
const { union: turfUnion } = requireFE('@turf/union');
const { intersect: turfIntersect } = requireFE('@turf/intersect');
const { area: turfArea } = requireFE('@turf/area');

// ─── Rep + market preset config (must mirror the frontend) ────────────────
const SALES_REPS = [
  { id: 'laramie', states: ['Wyoming'], partialStates: { Montana: { rule: 'south', latThreshold: 47.5 } } },
  { id: 'sid', states: ['New Mexico', 'Texas'], partialStates: {} },
  { id: 'miya', states: ['Oklahoma', 'Kansas', 'Missouri'], partialStates: {} },
  { id: 'matthew', states: ['Arizona', 'California', 'Oregon', 'Washington', 'Idaho'], partialStates: { Montana: { rule: 'north', latThreshold: 47.5 } } },
  { id: 'tyler', states: ['South Dakota', 'Nebraska', 'Iowa', 'Colorado'], partialStates: {} },
  { id: 'natalie', states: ['North Dakota', 'Minnesota'], partialStates: {} },
  { id: 'darren', states: ['Arkansas', 'Louisiana', 'Mississippi', 'Tennessee', 'Kentucky'], partialStates: {} },
];
const getRepStates = (id) => {
  const rep = SALES_REPS.find(r => r.id === id);
  if (!rep) return [];
  return [...rep.states, ...Object.keys(rep.partialStates)];
};

const NUTRIEN_SUBS = ['Nutrien Retail', 'Nutrien Terminal', 'Nutrien Storage', 'Nutrien Office'];

const MARKET_PRESETS = {
  wheat_abm: {
    radius: 75,
    layers: [
      'Aurora Coop', ...NUTRIEN_SUBS, 'Wilbur-Ellis', 'Helena Agri', 'Skyland Grain',
      'CHS Grain', 'McGregor Locations', 'MKC Grain',
      'CLS Customer Locations',
      '1000+ Wheat Growers', 'Wheat Acres',
    ],
    repIds: ['laramie', 'sid', 'miya', 'matthew', 'tyler', 'natalie'],
  },
  rice_abm: {
    radius: 75,
    layers: [
      'Riceland Co-op', 'Supreme Rice', 'Producers Rice Mill',
      'Poinsett Rice & Grain', 'Farmers Rice', 'Triton Fumigation',
      'Helena Agri', ...NUTRIEN_SUBS,
      '1000+ Rice Growers', 'Rice Acres',
    ],
    repIds: ['darren'],
  },
};

const DENSITY_LAYERS = [
  '1000+ Wheat Growers', '1000+ Corn Growers', '1000+ Rice Growers', '1000+ Hogs',
  'Wheat Acres', 'Corn Acres', 'Rice Acres', 'Farms with Grain Storage',
];

const COUNTY_RENAMES_LOCAL = { 'OGLALALAKOTA': 'SHANNON' };
const normalizeCountyName = (name) => {
  let n = String(name || '').toUpperCase().trim();
  n = n.replace(/ CITY$/, '');
  n = n.replace(/^SAINT /, 'ST ').replace(/^SAINTE /, 'STE ');
  n = n.replace(/^ST\. /, 'ST ').replace(/^STE\. /, 'STE ');
  n = n.replace(/\./g, '').replace(/'/g, '').replace(/Ñ/g, 'N').replace(/ñ/g, 'N');
  n = n.replace(/^DE /, 'DE').replace(/^LA /, 'LA').replace(/^LE /, 'LE');
  n = n.replace(/-/g, ' ');
  n = n.replace(/\s+/g, '');
  if (COUNTY_RENAMES_LOCAL[n]) n = COUNTY_RENAMES_LOCAL[n];
  return n;
};
const normalizeState = (s) => String(s || '').toUpperCase().trim().replace(/\s+/g, ' ');

const FIPS_TO_STATE = {
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California","08":"Colorado","09":"Connecticut","10":"Delaware",
  "11":"District of Columbia","12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa",
  "20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota",
  "28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico",
  "36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania","44":"Rhode Island",
  "45":"South Carolina","46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington",
  "54":"West Virginia","55":"Wisconsin","56":"Wyoming",
};

const milesBetween = (lon1, lat1, lon2, lat2) => {
  const R = 3958.8;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── CSV parsing (minimal) ────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] != null ? cells[idx] : ''; });
    rows.push(row);
  }
  return rows;
}
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = false; }
      } else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') inQuote = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// ─── Fetch counties GeoJSON (cached locally) ──────────────────────────────
async function loadCountiesGeoJSON() {
  if (fs.existsSync(COUNTIES_CACHE)) {
    return JSON.parse(fs.readFileSync(COUNTIES_CACHE, 'utf-8'));
  }
  console.log('Fetching counties GeoJSON…');
  const data = await new Promise((resolve, reject) => {
    https.get(COUNTIES_GEOJSON_URL, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve(chunks));
      res.on('error', reject);
    }).on('error', reject);
  });
  fs.writeFileSync(COUNTIES_CACHE, data);
  return JSON.parse(data);
}

// ─── Compute coverage for one market preset ───────────────────────────────
function computeForMarket(marketKey, locationRows, densityRows, countiesGeoJSON) {
  const preset = MARKET_PRESETS[marketKey];
  if (!preset) throw new Error('Unknown market: ' + marketKey);

  // ── Active layers + state filter from rep union
  const activeLayerSet = new Set(preset.layers);
  const stateUnion = new Set();
  preset.repIds.forEach(id => getRepStates(id).forEach(s => stateUnion.add(s)));

  // ── Filtered location points → "visible coverage pins"
  const visiblePins = [];
  locationRows.forEach(r => {
    const layer = r.layer || '';
    if (!activeLayerSet.has(layer)) return;
    const state = (r.state || '').trim();
    const stateTitle = state.replace(/\b\w/g, c => c.toUpperCase());
    if (!stateUnion.has(stateTitle)) return;
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    visiblePins.push([lon, lat]);
  });

  // ── Filtered density data: only counties in the state filter (matches LayerStats)
  const filteredDensity = densityRows.filter(r => {
    const state = (r.state || '').trim();
    const stateTitle = state.replace(/\b\w/g, c => c.toUpperCase());
    return stateUnion.has(stateTitle);
  });

  // ── Build canonical county basis (aggregate dupes by SUM, attach geometry)
  const aggregated = new Map();
  filteredDensity.forEach(d => {
    const key = `${normalizeState(d.state)}|${normalizeCountyName(d.county)}`;
    const existing = aggregated.get(key);
    const layers = existing ? existing.layers : {};
    DENSITY_LAYERS.forEach(l => {
      const v = parseFloat(d[l]);
      if (Number.isFinite(v)) layers[l] = (layers[l] || 0) + v;
    });
    aggregated.set(key, { state: d.state, county: d.county, layers });
  });
  const geomLookup = new Map();
  countiesGeoJSON.features.forEach(feat => {
    const stateName = FIPS_TO_STATE[feat.properties.STATE];
    if (!stateName) return;
    const key = `${normalizeState(stateName)}|${normalizeCountyName(feat.properties.NAME)}`;
    geomLookup.set(key, feat);
  });
  const counties = [];
  let missingGeometry = 0;
  aggregated.forEach((entry, key) => {
    const feat = geomLookup.get(key);
    if (!feat) { missingGeometry++; return; }
    counties.push({ key, ...entry, feature: feat });
  });

  // ── Canonical TAM
  const canonicalTotals = {};
  DENSITY_LAYERS.forEach(l => { canonicalTotals[l] = 0; });
  counties.forEach(c => {
    DENSITY_LAYERS.forEach(l => {
      const v = c.layers[l];
      if (typeof v === 'number') canonicalTotals[l] += v;
    });
  });

  // ── Spatial-index pins for locality
  const milesPerDegLat = 69;
  const cellDeg = Math.max(1, Math.ceil((preset.radius + 30) / milesPerDegLat));
  const pinCells = new Map();
  visiblePins.forEach((p, idx) => {
    const k = `${Math.floor(p[0] / cellDeg)},${Math.floor(p[1] / cellDeg)}`;
    const bucket = pinCells.get(k);
    if (bucket) bucket.push(idx);
    else pinCells.set(k, [idx]);
  });

  // ── Per-county locality-aware union + intersect
  const covered = {};
  DENSITY_LAYERS.forEach(l => { covered[l] = 0; });
  let withRatioGt0 = 0;
  let withRatioEq1 = 0;
  let intersectErrors = 0;

  let processed = 0;
  for (const c of counties) {
    const geom = c.feature.geometry;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polys) {
      for (const co of poly[0]) {
        if (co[0] < minX) minX = co[0]; if (co[0] > maxX) maxX = co[0];
        if (co[1] < minY) minY = co[1]; if (co[1] > maxY) maxY = co[1];
      }
    }
    const cLon = (minX + maxX) / 2;
    const cLat = (minY + maxY) / 2;
    const cornerMiles = milesBetween(cLon, cLat, maxX, maxY);
    const maxPinDist = cornerMiles + preset.radius + 1;
    const cx = Math.floor(cLon / cellDeg);
    const cy = Math.floor(cLat / cellDeg);
    const cellRange = Math.ceil(maxPinDist / (milesPerDegLat * cellDeg)) + 1;
    const nearby = [];
    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        const bucket = pinCells.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const pi of bucket) {
          const p = visiblePins[pi];
          if (milesBetween(cLon, cLat, p[0], p[1]) <= maxPinDist) nearby.push(p);
        }
      }
    }
    if (nearby.length === 0) { processed++; continue; }

    let smallUnion = null;
    try {
      if (nearby.length === 1) {
        smallUnion = circle(nearby[0], preset.radius, { steps: 32, units: 'miles' });
      } else {
        const circles = nearby.map(p => circle(p, preset.radius, { steps: 32, units: 'miles' }));
        smallUnion = turfUnion({ type: 'FeatureCollection', features: circles });
      }
    } catch (e) {
      intersectErrors++;
      processed++;
      continue;
    }
    if (!smallUnion) { processed++; continue; }

    let ratio = 0;
    try {
      const inter = turfIntersect({ type: 'FeatureCollection', features: [c.feature, smallUnion] });
      if (inter) {
        const countyArea = turfArea(c.feature);
        if (countyArea > 0) ratio = turfArea(inter) / countyArea;
      }
    } catch (e) { intersectErrors++; }
    if (!Number.isFinite(ratio) || ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    if (ratio > 0) {
      withRatioGt0++;
      if (ratio >= 0.999) withRatioEq1++;
      DENSITY_LAYERS.forEach(l => {
        const v = c.layers[l];
        if (typeof v === 'number' && v > 0) covered[l] += v * ratio;
      });
    }
    processed++;
    if (processed % 100 === 0) process.stdout.write(`  ${marketKey}: processed ${processed}/${counties.length}\r`);
  }
  process.stdout.write('\n');

  const display = {};
  const totalsDisplay = {};
  DENSITY_LAYERS.forEach(l => {
    display[l] = Math.round(Math.max(0, Math.min(covered[l], canonicalTotals[l])));
    totalsDisplay[l] = Math.round(canonicalTotals[l]);
  });

  return {
    market: marketKey,
    radius: preset.radius,
    visiblePinsCount: visiblePins.length,
    canonicalCountiesCount: counties.length,
    missingGeometry,
    countiesWithRatioGt0: withRatioGt0,
    countiesWithRatioEq1: withRatioEq1,
    intersectErrors,
    covered: display,
    canonicalTotals: totalsDisplay,
  };
}

// Convert a MongoDB density doc shape ({state, county, layers: {...}}) into the
// flat CSV-style shape the compute function expects.
function flattenDensityDoc(d) {
  const out = { state: d.state, county: d.county };
  if (d.layers) {
    Object.entries(d.layers).forEach(([k, v]) => { out[k] = v; });
  }
  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Connecting to ${MONGO_URL} / ${DB_NAME}…`);
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('Loading location_points + density_data from MongoDB…');
  const locationDocs = await db.collection('location_points').find({}, {
    projection: { layer: 1, lat: 1, lon: 1, state: 1 }
  }).toArray();
  const densityDocs = await db.collection('density_data').find({}).toArray();
  await client.close();

  const locationRows = locationDocs.map(d => ({ layer: d.layer, lat: d.lat, lon: d.lon, state: d.state }));
  const densityRows = densityDocs.map(flattenDensityDoc);
  console.log(`  location_points: ${locationRows.length} rows`);
  console.log(`  density_data:    ${densityRows.length} rows`);

  const countiesGeoJSON = await loadCountiesGeoJSON();
  console.log(`  counties:        ${countiesGeoJSON.features.length} features`);

  const entries = [];
  for (const marketKey of Object.keys(MARKET_PRESETS)) {
    console.log(`\nComputing ${marketKey} @ ${MARKET_PRESETS[marketKey].radius}mi…`);
    const t0 = Date.now();
    const result = computeForMarket(marketKey, locationRows, densityRows, countiesGeoJSON);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ${marketKey} done in ${elapsed}s`);
    console.log(`    pins: ${result.visiblePinsCount}, counties: ${result.canonicalCountiesCount}, missing geom: ${result.missingGeometry}`);
    console.log(`    ratio>0: ${result.countiesWithRatioGt0}, ratio=1: ${result.countiesWithRatioEq1}, errors: ${result.intersectErrors}`);
    console.log(`    covered growers (wheat/rice): ${result.covered['1000+ Wheat Growers']} / ${result.covered['1000+ Rice Growers']}`);
    console.log(`    TAM growers (wheat/rice):     ${result.canonicalTotals['1000+ Wheat Growers']} / ${result.canonicalTotals['1000+ Rice Growers']}`);
    entries.push(result);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    entries,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${OUT_PATH}`);
})();
