# Data Dictionary

This document describes all datasets in the Territory Atlas application.
Full data exports are in  as JSON files.

## Collections

### location_points (Individual Map Markers)
Total records: **40075**

| Layer | Count | States | Sample Fields |
|-------|-------|--------|--------------|
| CHS Agronomy | 102 | Colorado, Idaho, Kansas, Minnesota, Montana (+4 more) | name, division, layer, city, state, address, lat, lon |
| CHS Grain | 120 | Colorado, Idaho, Kansas, Minnesota, Montana (+4 more) | name, division, layer, city, state, address, lat, lon |
| CLS Customer Head Sheds | 1047 | Alabama, Arizona, Arkansas, California, Colorado (+39 more) | name, customer_name, ship_to_name, layer, city, state, lat, lon |
| FSS Flour Mills | 161 | Alabama, Arizona, Arkansas, BC, California (+35 more) | name, layer, city, state, lat, lon, capacity, address |
| FSS Grain | 1019 | Alabama, Arizona, Arkansas, California, Colorado (+34 more) | name, layer, city, state, lat, lon, capacity, address |
| FSS Mix Plants | 81 | Arkansas, BC, California, Colorado, Connecticut (+25 more) | name, layer, city, state, lat, lon, capacity, address |
| FSS Specialty Mills | 372 | Arizona, Arkansas, BC, California, Colorado (+35 more) | name, layer, city, state, lat, lon, capacity, address |
| Feed Manufacturers | 665 | Alabama, Arizona, Arkansas, California, Colorado (+40 more) | name, layer, city, state, lat, lon, address, zip |
| Feed Stores | 7878 | Alabama, Alaska, Arizona, Arkansas, California (+45 more) | name, layer, city, state, lat, lon, address, zip |
| Grain Elevators | 4538 | Alabama, Alaska, Arizona, Arkansas, California (+42 more) | name, layer, city, state, lat, lon, address, zip |
| Grain Fumigation | 59 | Arizona, Arkansas, California, Colorado, Florida (+25 more) | name, layer, city, state, lat, lon, type, region |
| MKC Agronomy | 22 | Kansas | name, layer, city, state, address, lat, lon |
| MKC Grain | 40 | Kansas | name, layer, city, state, address, lat, lon |
| McGregor Locations | 28 | Idaho, Oregon, Washington | name, layer, city, state, address, lat, lon |
| Pest Control | 23737 | Alabama, Alaska, Arizona, Arkansas, California (+46 more) | name, layer, city, state, lat, lon, address, zip |
| Terminals Corn & Soybean | 25 | Illinois, Missouri | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals HRS Wheat | 8 | Minnesota, North Dakota | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals HRW Wheat | 17 | Kansas | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals Oats | 6 | Minnesota, Wisconsin | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals Rough Rice | 21 | Arkansas | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals SRW Wheat | 61 | Arkansas, Illinois, Indiana, Kentucky, Michigan (+3 more) | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals Soybean Meal | 33 | Alabama, Arkansas, Illinois, Indiana, Iowa (+3 more) | name, layer, city, state, lat, lon, capacity, commodity |
| Terminals Soybean Oil | 35 | Illinois, Indiana, Iowa, Kansas, Minnesota (+3 more) | name, layer, city, state, lat, lon, capacity, commodity |

### density_data (County-Level Choropleth)
Total records: **5535**

Each record has: , ,  (dict of layer_name → numeric value)

| Layer | Total Value | Description |
|-------|------------|-------------|
| Corn Acres | 80,434,552 | County-level density |
| Wheat Acres | 37,093,086 | County-level density |
| Rice Acres | 2,265,551 | County-level density |
| Farms with Grain Storage | 263,164 | County-level density |
| 1000+ Corn Growers | 48,546 | County-level density |
| 1000+ Wheat Growers | 25,704 | County-level density |
| 1000+ Hogs | 9,813 | County-level density |
| 1000+ Rice Growers | 2,110 | County-level density |

### Schema

**location_points**: 

**density_data**: 

## Market View Presets

| Market | Active Layers |
|--------|--------------|
| Wheat | FSS (all 4), Terminals SRW/HRW/HRS Wheat, CHS Grain, MKC Grain, McGregor, Grain Elevators, CLS Head Sheds, Fumigation, 1000+ Wheat Growers, Wheat Acres |
| Rice | FSS (all 4), Terminals Rough Rice, CHS Grain, MKC Grain, McGregor, Grain Elevators, CLS Head Sheds, Fumigation, 1000+ Rice Growers, Rice Acres |
| Corn | FSS Grain/Specialty/Mix, Terminals Corn & Soybean, CHS Grain, MKC Grain, McGregor, Grain Elevators, CLS Head Sheds, Fumigation, 1000+ Corn Growers, Corn Acres |
| Hogs | Terminals Corn & Soybean/Soybean Oil/Soybean Meal, CLS Head Sheds, Feed Manufacturers, Corn Acres, 1000+ Hogs |
| Alternative | CLS Head Sheds, Grain Fumigation, Pest Control, 1000+ Wheat/Corn/Rice Growers, Farms with Grain Storage |

## Sales Rep Territories

| Rep | States |
|----|--------|
| Laramie Wiginton | WY + southern MT (below 47.5° lat) |
| Sid Chambers | NM, TX |
| Miya Butler | OK, KS, MO |
| Matthew Horlacher | AZ, CA, OR, WA, ID + northern MT |
| Tyler Pierson | SD, NE, IA, CO |
| Natalie Tokach | ND, MN |
