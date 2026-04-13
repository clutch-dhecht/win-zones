# Territory Atlas (CLS Win Zones) - Product Requirements Document

## Problem Statement
Interactive map visualization app for sales territory mapping. Market-focused UX with one-click market presets, state filtering, density choropleth, individual point markers with clustering, Win Zones analysis (Coverage + Opportunity), and actionable Win Zone Cards with categorized breakdowns.

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
- [x] Win Zones: Coverage (density × proximity) and Opportunity (density × gap)
- [x] Win Zone Cards: Top 3 clustered zones with categorized breakdowns
  - Market Size / People to Reach / Partners-Distribution / CLS Distribution
  - View on Map zoom, county list, nearest CLS customer city/state
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

## P2 - Future/Backlog
- Draw circle/polygon tools for custom territory selection
- CSV/PDF export functionality
- Backend spatial filtering for 100k+ scaling
