# Territory Atlas (CLS Win Zones) - Product Requirements Document

## Problem Statement
Interactive map visualization app for sales territory mapping. Market-focused UX with one-click market presets, state filtering, density choropleth, individual point markers with clustering, Win Zones analysis (Coverage + Opportunity + Market), and actionable Win Zone Cards with categorized breakdowns.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, react-map-gl (Mapbox GL JS), @turf/circle, Shadcn UI
- **Backend**: FastAPI, Pandas, Motor (MongoDB async), openpyxl (XLSX support)
- **Database**: MongoDB (location_points, density_data collections)
- **Map**: Mapbox GL JS

## What's Implemented
- [x] Market Views: Rice, Wheat, Corn, Hogs, Pest Control presets
- [x] State filter dropdown (filters all data + zooms map)
- [x] Layer stats summary (auto-totals per active layer)
- [x] Per-layer density choropleth with FIPS normalization (99.1% match)
- [x] Individual location points (36k+ other + 1,047 CLS) with clustering
- [x] CLS Customers: 1,047 individual records with Customer Name + Ship To Name (from XLSX import)
  - Popup shows Ship To Name (bold), Customer Name, layer label, City/State
- [x] Geographic radius circles (@turf/circle)
- [x] Win Zones: Coverage, Opportunity, and Market modes
- [x] State-seeded clustering algorithm (ranks states by total density, seeds zones from top states)
- [x] Win Zone Cards: Top 5 clustered zones, 3 shown by default, zones 4-5 hidden on map
  - Market Size / People to Reach / Partners-Distribution
  - View on Map zoom, county list, nearest CLS customer
  - Eye toggle for map outline visibility per zone
- [x] Zone Focus: Local (40mi/25 counties), Regional (100mi/75), Territory (150mi/150)
- [x] Market Coverage Cap: 85% ensures 3+ meaningful zones
- [x] Market mode uses market_score (pure density) — avoids penalizing well-covered areas
- [x] Layer color picker, hover tooltips, click popups
- [x] Mobile responsive (slide-over panel)
- [x] US state + Canadian province border lines
- [x] Data upload: CSV and XLSX support with auto-column rename and CLS format detection
- [x] Density uploads merge across files
- [x] XLSX upload support for CLS Customer format (Customer Name, Ship To Name, City, State)

## Data Collections
- **location_points**: Individual markers (Grain Elevators, Feed Manufacturers, Feed Stores, Pest Control, CLS Customers)
  - CLS Customers have extra fields: `customer_name`, `ship_to_name`
- **density_data**: County-level choropleth (Wheat/Corn/Rice Acres, Growers, Hogs, Farms with Grain Storage)
- **point_data**: Legacy aggregated city data (currently empty after CLS migration to location_points)

## Layer Categories
- **Market Size**: Wheat/Corn/Rice Acres, 1000+ Hogs
- **People to Reach**: 1000+ Growers (all types), Farms with Grain Storage, Pest Control
- **Partners/Distribution**: Grain Elevators, Feed Manufacturers, Feed Stores
- **CLS**: CLS Customers (manual-only, advanced panel)

## P1 - Upcoming
- Backend spatial filtering (`bbox` query params) for viewport-only data (100k+ scaling)
- Address-level geocoding for CSVs without lat/lon

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- CSV/PDF export functionality
