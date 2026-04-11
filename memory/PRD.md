# Territory Atlas - Product Requirements Document

## Problem Statement
Interactive map visualization app for sales territory mapping. Upload CSV datasets to visualize point markers, county density choropleth, radius coverage circles, and identify "Win Zones" — high-opportunity areas with low existing coverage.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, `react-map-gl` (Mapbox GL JS), `@turf/circle`, Shadcn UI
- **Backend**: FastAPI, Pandas, Motor (MongoDB async driver)
- **Database**: MongoDB (point_data, density_data collections + legacy fallbacks)
- **Map**: Mapbox GL JS

## Architecture
```
/app/
├── backend/
│   ├── server.py                       # FastAPI: upload/point, upload/density, data endpoints, analytics
│   ├── us_cities_data.py               # US state validation
│   ├── us_cities_coordinates.csv       # City geocoding lookup
├── frontend/
│   ├── src/
│   │   ├── config/layerConfig.js       # Layer types, colors, radius config
│   │   ├── components/
│   │   │   ├── MapboxVisualization.js   # Mapbox GL: choropleth, clusters, radius, win zones heatmap
│   │   │   ├── MapDashboard.js          # State management, data fetching
│   │   │   ├── LayerControls.js         # Grouped layers, toggles, color picker, Win Zones toggle
│   │   │   ├── FileUpload.js            # Point Data / Density Data upload
│   │   │   └── Analytics.js             # Top opportunity zones
```

## Upload Types
- **Point Data**: CSV with `City, State` + numeric columns → geocoded, markers with optional radius
- **Density Data**: CSV with `County, State` + numeric columns → county choropleth. Multiple uploads merge layers.

## Layer Configuration
**Point Layers**: Feed Mills, Hog Producers, Grain Fumigation, Customers (with radius 25/50/100mi)
**Density Layers**: 1000-plus Acre Growers, Growers with On Farm Storage, Grain Retail Handlers, Acres

## API Endpoints
- `POST /api/upload/point` - Upload point CSV (City/State + layers)
- `POST /api/upload/density` - Upload density CSV (County/State + layers), merges with existing
- `GET /api/data/point` - Get all point data
- `GET /api/data/density` - Get all merged density data
- `GET /api/analytics/top-zones` - Top 10 states by active layers

## What's Implemented
- [x] CSV upload (2 types: Point Data, Density Data)
- [x] Density uploads merge layers across multiple files
- [x] Local geocoding using US cities database
- [x] Mapbox GL JS with proper token
- [x] Per-layer county choropleth with FIPS mapping + name normalization (99.1% match)
- [x] Per-layer independent log-scaled opacity
- [x] Point markers with Mapbox native clustering
- [x] Geographic radius circles (@turf/circle, 25/50/100 miles)
- [x] Layer color picker (15 presets, real-time map update)
- [x] Win Zones scored heatmap: `win_score = density × (1 - coverage)`
  - Coverage = inverse-distance to nearest radius-enabled points (0mi=1.0, 200mi=0)
  - Hot red/orange = high density, far from existing infrastructure
  - Legend, hover tooltip (Win %, nearest distance), click popup with details
- [x] US state + Canadian province bold border lines
- [x] Hover tooltips on markers and counties
- [x] Click popups with layer breakdown
- [x] Map style toggle (Street/Satellite)
- [x] Top opportunity zones analytics panel

## P1 - Upcoming
- Backend spatial filtering (bbox viewport queries) for 100k+ point scaling
- Future point data with address-level geocoding (Address, City, State, Zip)

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- CSV/PDF export functionality
- Data editing/re-upload workflow
