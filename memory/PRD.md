# Territory Atlas (CLS Win Zones) - Product Requirements Document

## Problem Statement
Interactive map visualization for sales territory mapping with dual Win Zone systems, market presets, density choropleth, point clustering, weighted scoring model, and sales rep territory overlays.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, react-map-gl (Mapbox GL JS), @turf/circle, Shadcn UI
- **Backend**: FastAPI, Pandas, Motor (MongoDB async), openpyxl
- **Database**: MongoDB (location_points, density_data)
- **Map**: Mapbox GL JS

## What's Implemented

### Core
- [x] Market Views: Wheat, Rice, Corn, Hogs, Alternative (default: Wheat on load)
- [x] State filter, Layer Stats (branded #D15E13), Mobile responsive
- [x] Per-layer density choropleth, loose clustering (radius 18, maxZoom 11)
- [x] 40k+ location points with clustering

### Sales Rep Territories (NEW)
- [x] Master toggle shows colored state fills + borders for 6 reps
- [x] Sub-filter: individual rep eye toggles + zoom-to-territory crosshair
- [x] Montana split at latitude 47.5° (south = Laramie, north = Matthew)
- [x] Reps: Laramie (WY+south MT), Sid (TX+NM), Miya (OK+KS+MO), Matthew (WA+OR+ID+CA+NV+UT+AZ+north MT), Tyler (SD+NE+IA+MN+CO), Natalie (ND)

### Win Zones
- [x] Market / Coverage / Opportunity modes (green/purple/orange)
- [x] State-seeded clustering, Zone Focus (Local/Regional/Territory)
- [x] **Per Rep mode**: One best zone per sales rep (6 zones named after reps)
- [x] Backfill pass, one-zone-per-state rule, max 60 counties
- [x] Top 10 counties per zone with people-to-reach breakdown

### Weighted Win Zones (hidden, code preserved)
- [x] 3-factor model: Opportunity (60%) + Access (30%) + Efficiency (10%)
- [x] Opportunity gate, state-total blend, P90 normalization
- [x] Advanced Settings panel with weight sliders + efficiency constants

### Data Layers
- Point: CLS Head Sheds (1,047), Grain Elevators (4,538), Feed Mfrs, Feed Stores, Pest Control, Grain Fumigation (59)
- Industry groups: FSS Milling (4 sub-layers), Grain Terminals (8 sub-layers), CHS Locations (Grain+Agronomy), MKC Locations (Grain+Agronomy)
- Density: Wheat/Corn/Rice Acres, 1000+ Growers, 1000+ Hogs, Farms w/ Grain Storage

### Startup Seed
- All imported data auto-seeds from `/backend/seed_data/` on fresh deploy
- Includes: CLS, Fumigation, FSS, Terminals, CHS, MKC, Hogs update

## P1 - Upcoming
- Backend spatial filtering for 100k+ scaling
- Address-level geocoding for CSVs without lat/lon

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- CSV/PDF export functionality
- Re-enable Weighted Win Zones when model is refined
