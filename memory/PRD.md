# Territory Atlas - Product Requirements Document

## Problem Statement
Interactive map visualization app for sales territory mapping using CSV datasets (City/State/Counts, County/State/Counts, Wheat Acres). Features: dynamic layer toggling, density choropleth shading for county data, point markers with clustering, toggleable radius circles (25/50/100 miles), customizable layer colors, hover tooltips, and analytics panel.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, `react-map-gl` (Mapbox GL JS), `@turf/circle`, Shadcn UI
- **Backend**: FastAPI, Pandas, Motor (MongoDB async driver)
- **Database**: MongoDB (city_data, county_data, wheat_data collections)
- **Map**: Mapbox GL JS with user token

## Architecture
```
/app/
├── backend/
│   ├── server.py                       # FastAPI endpoints, geocoding, data storage
│   ├── us_cities_data.py               # US state validation
│   ├── us_cities_coordinates.csv       # City geocoding lookup
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── config/layerConfig.js       # Layer types, colors, radius config
│   │   ├── components/
│   │   │   ├── MapboxVisualization.js   # Mapbox GL with choropleth, clusters, radius, hover
│   │   │   ├── MapDashboard.js          # Main wrapper, data fetching, state (incl. layerColors)
│   │   │   ├── LayerControls.js         # Grouped layers, switch toggles, color picker
│   │   │   ├── FileUpload.js            # Single upload with file type dropdown
│   │   │   └── Analytics.js             # Top opportunity zones panel
│   │   ├── App.js
│   │   └── index.css
│   ├── package.json
│   └── .env
```

## Layer Configuration
**Point Layers** (city-level, lat/lon markers with clustering):
- Feed Mills (radius: 25/50/100mi)
- Hog Producers (no radius)
- Grain Fumigation (radius: 25/50/100mi)
- Customers (radius: 25/50/100mi)

**Density Layers** (county-level choropleth):
- 1000-plus Acre Growers
- Growers with On Farm Storage
- Grain Retail Handlers
- Acres (wheat base layer)

## API Endpoints
- `POST /api/upload/city` - Upload city CSV
- `POST /api/upload/county` - Upload county CSV
- `POST /api/upload/wheat` - Upload wheat CSV
- `GET /api/data/city` - Get all city data with coordinates
- `GET /api/data/county` - Get all county data
- `GET /api/data/wheat` - Get all wheat data
- `GET /api/analytics/top-zones` - Top 10 states aggregated by active layers

## What's Implemented
- [x] CSV file upload and parsing (City, County, Wheat)
- [x] Local geocoding using comprehensive US cities database
- [x] Mapbox GL JS map rendering with proper token
- [x] County choropleth density shading with FIPS-to-State mapping
- [x] County name normalization (SAINT/ST, DEKALB, Virginia CITY, apostrophes, hyphens) — 99.1% match rate
- [x] Log-scaled opacity for visibility across data ranges
- [x] Point markers with Mapbox native clustering
- [x] Geographic radius circles using @turf/circle (25/50/100 miles)
- [x] Single file upload with type dropdown selector
- [x] Layer controls grouped (Point/Density) with collapsible sections
- [x] Switch toggles with inactive layers faded out (opacity 0.4)
- [x] Color picker per layer (15 preset colors, updates map in real-time)
- [x] Hover tooltips on markers and counties
- [x] Click popups with detailed breakdown
- [x] Map style toggle (Street/Satellite)
- [x] Top opportunity zones analytics panel
- [x] MongoDB storage for all datasets
- [x] Per-layer density isolation — each density layer renders as its own Mapbox fill layer with independent color and log-scaled normalization. Toggling off "Acres" reveals other layers clearly.

## Data Alignment Notes
- 99.1% county match rate (2347/2368) with normalization
- 21 remaining unmatched are data quality issues: cross-state county assignments in wheat data, Connecticut planning regions, renamed counties (Oglala Lakota)

## P1 - Upcoming
- Backend spatial filtering (bbox viewport queries) for 100k+ point scaling

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- Coverage heatmaps and gap analysis
- CSV/PDF export functionality
- Data editing/re-upload workflow
