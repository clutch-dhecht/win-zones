# Territory Atlas (CLS Win Zones) - Product Requirements Document

## Problem Statement
Interactive map visualization app for sales territory mapping. Market-focused UX with one-click market presets, state filtering, density choropleth, individual point markers with clustering, Win Zones analysis (Coverage + Opportunity + Market), and actionable Win Zone Cards with categorized breakdowns.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, react-map-gl (Mapbox GL JS), @turf/circle, Shadcn UI
- **Backend**: FastAPI, Pandas, Motor (MongoDB async)
- **Database**: MongoDB (point_data, location_points, density_data collections)
- **Map**: Mapbox GL JS

## What's Implemented
- [x] Market Views: Rice, Wheat, Corn, Hogs, Pest Control presets
- [x] State filter dropdown (filters all data + zooms map)
- [x] Layer stats summary (auto-totals per active layer)
- [x] Per-layer density choropleth with FIPS normalization (99.1% match)
- [x] Individual location points (36k+) with clustering
- [x] Aggregated city-level points (CLS Customers)
- [x] Geographic radius circles (@turf/circle)
- [x] Win Zones: Coverage, Opportunity, and Market modes
- [x] State-seeded clustering algorithm (ranks states by total density, seeds zones from top states)
- [x] Win Zone Cards: Top 5 clustered zones, 3 shown by default, zones 4-5 hidden on map
  - Market Size / People to Reach / Partners-Distribution / CLS Distribution
  - View on Map zoom, county list, nearest CLS customer city/state
  - Eye toggle for map outline visibility per zone
- [x] Zone Focus: Local (40mi/25 counties), Regional (100mi/75), Territory (150mi/150)
- [x] Market Coverage Cap: 85% cap ensures 3+ meaningful zones
- [x] Market mode uses market_score (pure density) — avoids penalizing well-covered areas
- [x] Layer color picker, hover tooltips, click popups
- [x] Mobile responsive (slide-over panel)
- [x] US state + Canadian province border lines
- [x] Data upload (Point Data / Density Data) with auto-column rename
- [x] Density uploads merge across files

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
