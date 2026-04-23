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
- [x] Individual location points (36k+ other + 1,047 CLS + 1,898 new industry) with clustering
- [x] CLS Customers: 1,047 individual records with Customer Name + Ship To Name
- [x] Geographic radius circles (@turf/circle)
- [x] Win Zones: Coverage, Opportunity, and Market modes
- [x] State-seeded clustering algorithm
- [x] Win Zone Cards: Top 5 zones, 3 shown by default, zones 4-5 hidden on map
- [x] Zone Focus: Local / Regional / Territory
- [x] Layer color picker, hover tooltips, click popups with extra fields (capacity, type, commodity)
- [x] Mobile responsive (slide-over panel)
- [x] US state + Canadian province border lines
- [x] Data upload: CSV and XLSX support
- [x] **Grain Fumigation** layer (59 points) — single toggleable layer
- [x] **FSS Milling** group with sub-filter by Category:
  - FSS Grain (1,019) | FSS Flour Mills (161) | FSS Specialty Mills (372) | FSS Mix Plants (81)
  - Collapsible group with master toggle + individual sub-toggles
- [x] **Grain Terminals** group with sub-filter by Commodity:
  - Terminals SRW Wheat (61) | HRW Wheat (17) | HRS Wheat (8) | Corn & Soybean (25) | Rough Rice (21) | Oats (6) | Soybean Oil (35) | Soybean Meal (33)
  - Collapsible group with master toggle + individual sub-toggles
- [x] Industry Layers section in Advanced Data Layers panel

## Data Collections
- **location_points**: Individual markers
  - Point Layers: Grain Elevators, Feed Manufacturers, Feed Stores, Pest Control, CLS Customers
  - Industry: Grain Fumigation, FSS Grain/Flour/Specialty/Mix, Terminals by commodity
- **density_data**: County-level choropleth
- **point_data**: Legacy (currently empty)

## Layer Categories (Win Zones)
- **Market Size**: Wheat/Corn/Rice Acres, 1000+ Hogs
- **People to Reach**: 1000+ Growers, Farms with Grain Storage, Pest Control
- **Partners/Distribution**: Grain Elevators, Feed Manufacturers, Feed Stores, Grain Fumigation, all FSS layers, all Terminal layers
- **CLS**: CLS Customers

## P1 - Upcoming
- Adjust Market View presets to include new layers (user requested for later)
- Backend spatial filtering for viewport-only data (100k+ scaling)
- Address-level geocoding for CSVs without lat/lon

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- CSV/PDF export functionality
