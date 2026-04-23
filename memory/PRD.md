# Territory Atlas (CLS Win Zones) - Product Requirements Document

## Problem Statement
Interactive map visualization app for sales territory mapping with dual Win Zone analysis systems, market presets, density choropleth, point clustering, and advanced weighted scoring model.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, react-map-gl (Mapbox GL JS), @turf/circle, Shadcn UI
- **Backend**: FastAPI, Pandas, Motor (MongoDB async), openpyxl
- **Database**: MongoDB (location_points, density_data)
- **Map**: Mapbox GL JS

## What's Implemented

### Core Features
- [x] Market Views: Wheat, Rice, Corn, Hogs, Pest Control (with full layer matrix)
- [x] State filter, Layer Stats, Mobile responsive
- [x] Per-layer density choropleth (99.1% FIPS match)
- [x] Individual location points (40k+) with loose clustering
- [x] Data upload: CSV + XLSX support

### Data Layers
- Point: CLS Customer Head Sheds (1,047), Grain Elevators (4,538), Feed Mfrs, Feed Stores, Pest Control
- Industry: Grain Fumigation (59), FSS Milling (4 sub-layers, 1,633), Grain Terminals (8 commodity sub-layers, 206), CHS Locations (Grain 151 + Agronomy 104)
- Density: Wheat/Corn/Rice Acres, 1000+ Growers (3 types), 1000+ Hogs, Farms w/ Grain Storage

### Win Zones (Original)
- [x] Market / Coverage / Opportunity modes
- [x] State-seeded clustering, Zone Focus (Local/Regional/Territory)
- [x] Top 5 zones, 3 shown by default, eye toggles, Top 10 counties per zone

### Weighted Win Zones (NEW)
- [x] Independent 3-factor scoring model: Opportunity (40%) + Access (40%) + Efficiency (20%)
- [x] Opportunity: Crop acreage normalized per county
- [x] Access: Weighted point counts with crop-relevant filtering + synergy multipliers (CLS+Growers=1.5x, Elevators+Fumigation=1.3x, FSS+CHS=1.2x)
- [x] Efficiency: 1/(impressions/access_points) for Wheat/Corn/Rice; gracefully excluded for Hogs/Pest
- [x] Advanced Settings: Weight sliders + editable efficiency constants (session-persisted)
- [x] Separate cyan map outlines, independent from original red/orange zones
- [x] Can run simultaneously with original Win Zones

## P1 - Upcoming
- Backend spatial filtering for 100k+ scaling
- Address-level geocoding for CSVs without lat/lon

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- CSV/PDF export functionality
