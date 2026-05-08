# Wheat & Rice Win Zones — Data Coverage Audit

**Generated:** 2026-05-08
**Source data:** `data_exports/location_points.csv` (40,075 rows, 23 layers) + `data_exports/density_data.csv` (5,535 counties, 8 density layers)

## Scoping note

The platform's "Win Zones" are not predefined named regions — they are clusters of high-scoring counties computed dynamically by `WinZoneCards.js` using a proximity-based clustering algorithm against the active market layers. Reproducing the exact county membership of each clustered zone (e.g. Central North Dakota = 68 counties) requires reproducing the JS clustering logic against a US counties GeoJSON.

For a tractable audit, this document scopes by **state membership** based on the displayed zone names in the UI:

- **Wheat zones (combined: Central ND + Central KS + Central WA/OR)**
  - **Core** = ND, KS, WA, OR (4 zone-name states)
  - **Adjacent** = MN, SD, OK, NE, ID (likely overflow into the actual zone clusters)
- **Rice zones (combined: Central AR + South LA)**
  - AR + LA (Arkansas has exactly 75 counties, matching the displayed "Central Arkansas" county count almost 1:1; Louisiana has 64 parishes, vs the displayed 61 for South Louisiana)

State scoping slightly *overstates* zone footprint vs the platform's exact county clusters; this is conservative and the layer counts shown are upper-bound estimates of zone coverage.

## Important caveat — pre-deploy snapshot

`location_points.csv` was exported from production **before** PR #1 (Nutrien Locations + Rice Commercial co-ops) was deployed. As a result, this audit shows `0` for those four new layers:

| Layer | This audit | Will show after deploy |
|---|---:|---:|
| Nutrien Locations | 0 | 86 (AR, LA, MO, MS) |
| Riceland Co-op | 0 | 22 (AR + 2 in MO) |
| Supreme Rice | 0 | 1 (LA) |
| Producers Rice Mill | 0 | 11 (AR, MS) |

Those numbers are documented separately and should be reflected in the next production export.

---

# 🌾 Wheat Win Zones — Combined Audit

## Geographic scope

| Bucket | States | Counties |
|---|---|---:|
| Core (4 zone-name states) | Kansas, North Dakota, Oregon, Washington | 470 |
| Core + Adjacent (9 states) | + Idaho, Minnesota, Nebraska, Oklahoma, South Dakota | 1,198 |

## Point layer record counts

| Layer | Core | Core+Adj | US Total | States Present |
|---|---:|---:|---:|---|
| FSS Grain | 125 | 291 | 1,019 | ID, KS, MN, NE, ND, OK, OR, SD, WA |
| FSS Flour Mills | 19 | 31 | 161 | ID, KS, MN, NE, ND, OK, WA |
| FSS Specialty Mills | 41 | 77 | 372 | ID, KS, MN, NE, ND, OK, OR, SD |
| FSS Mix Plants | 9 | 11 | 81 | KS, MN, ND, OR, WA |
| **Terminals SRW Wheat** | **0** | **0** | **61** | **— (gap; SRW geography is IL/IN/KY/MI/OH, not in this zone)** |
| Terminals HRW Wheat | 17 | 17 | 17 | KS (entire layer in zone) |
| Terminals HRS Wheat | 1 | 8 | 8 | MN, ND (entire layer in zone) |
| CHS Grain | 41 | 89 | 120 | ID, KS, MN, NE, ND, SD, WA (74% of US) |
| MKC Grain | 40 | 40 | 40 | KS only — 100% of layer is in zone |
| McGregor Locations | 22 | 28 | 28 | ID, OR, WA — 100% of layer is in zone |
| Grain Elevators | 756 | 1,626 | 4,538 | All 9 zone states (36% of US) |
| CLS Customer Head Sheds | 103 | 202 | 1,047 | All 9 zone states (19% of US) |
| Grain Fumigation | 14 | 20 | 59 | 8 zone states (34% of US) |

**Point-layer Wheat-zone footprint:** 13 layers × ~2,440 records (Core+Adj scope, excl. SRW gap).

## Density layer totals

| Layer | Zone Total | US Total | % of US | Counties w/ Data |
|---|---:|---:|---:|---:|
| 1000+ Wheat Growers | 15,374 | 25,704 | **59.8%** | 526 of 1,198 |
| Wheat Acres | 23,179,020 | 37,093,086 | **62.5%** | 513 of 1,198 |

### 1000+ Wheat Growers by state

| State | Growers |
|---|---:|
| Kansas | 4,152 |
| North Dakota | 3,722 |
| Oklahoma | 1,916 |
| Washington | 1,545 |
| South Dakota | 1,228 |
| Minnesota | 961 |
| Idaho | 792 |
| Nebraska | 555 |
| Oregon | 503 |

### Wheat Acres by state

| State | Acres |
|---|---:|
| Kansas | 6,629,443 |
| North Dakota | 6,171,456 |
| Oklahoma | 2,565,679 |
| Washington | 2,374,137 |
| South Dakota | 1,432,291 |
| Minnesota | 1,267,187 |
| Idaho | 1,162,132 |
| Nebraska | 839,916 |
| Oregon | 736,779 |

## Field availability per Wheat-zone point layer

All layers have **100% completeness** on `name`, `city`, `state`, `lat`, `lon`. Optional / variable-completeness fields below.

| Layer | Records | Optional Field Completeness |
|---|---:|---|
| FSS Grain | 291 | address: 100%, **capacity: 96.6%** |
| FSS Flour Mills | 31 | address: 100%, **capacity: 87.1%** |
| FSS Specialty Mills | 77 | address: 100%, **capacity: 59.7%** ← partial |
| FSS Mix Plants | 11 | address: 100% |
| Terminals HRW Wheat | 17 | capacity: 100%, commodity: 100% |
| Terminals HRS Wheat | 8 | capacity: 100%, commodity: 100% |
| CHS Grain | 89 | address: 100%, division: 100% |
| MKC Grain | 40 | address: 100% |
| McGregor Locations | 28 | address: 100% |
| Grain Elevators | 1,626 | address: 95.3% |
| CLS Customer Head Sheds | 202 | customer_name: 100%, ship_to_name: 100% |
| Grain Fumigation | 20 | type: 100%, region: 100% |

## Wheat zone — strengths and gaps

### Strengths
- Density coverage: ~60% of all 1000+ Wheat Growers and 62% of all Wheat Acres in the US
- **Complete coverage** of MKC Grain, McGregor Locations, Terminals HRW Wheat, Terminals HRS Wheat (entire layer is in zone)
- High geographic completeness on every point layer (lat/lon = 100%)
- 1,626 Grain Elevators — strong supply-chain footprint

### Gaps
- **Terminals SRW Wheat (0 records in zone)** — SRW (Soft Red Winter) wheat is grown in IL/IN/KY/MI/OH/AR, geographically distinct from these Win Zones. Currently mismatched with the Wheat market preset's geography.
- **No Oregon/Idaho CHS Grain coverage** — CHS Grain is present in 7 of 9 zone states but missing from OR (and only 1 record in ID). McGregor fills the OR/ID/WA niche but isn't a 1:1 equivalent.
- **FSS Specialty Mills capacity field only 60% populated** in zone — meaningful operational data is missing for ~30 records.
- **40% of US Wheat Growers and 38% of Wheat Acres fall outside this zone scope** — primarily MT, TX, CO, IL — represents potential expansion.

---

# 🌾 Rice Win Zones — Combined Audit (Central AR + South LA)

## Geographic scope

| Scope | States | Counties / Parishes |
|---|---|---:|
| Rice zones | Arkansas, Louisiana | 219 (75 AR + 64 LA, with duplicate-case rows in source) |

## Point layer record counts

| Layer | AR+LA | US Total | By State |
|---|---:|---:|---|
| FSS Grain | 83 | 1,019 | AR=56, LA=27 |
| FSS Flour Mills | 2 | 161 | AR=1, LA=1 |
| FSS Specialty Mills | 23 | 372 | AR=18, LA=5 |
| FSS Mix Plants | 1 | 81 | AR=1 |
| Terminals Rough Rice | 21 | 21 | AR=21 (100% of layer in zone) |
| **Nutrien Locations** | 0* | 0* | *post-deploy: ~63 in AR+LA |
| **Riceland Co-op** | 0* | 0* | *post-deploy: 22 (AR) |
| **Supreme Rice** | 0* | 0* | *post-deploy: 1 (LA) |
| **Producers Rice Mill** | 0* | 0* | *post-deploy: ~9 (AR) |
| Grain Elevators | 134 | 4,538 | AR=78, LA=56 |
| CLS Customer Head Sheds | 70 | 1,047 | AR=49, LA=21 |
| Grain Fumigation | 1 | 59 | AR=1 |

*Layers added in PR #1 — will populate after next production deploy.

## Density layer totals

| Layer | AR+LA Total | US Total | % of US |
|---|---:|---:|---:|
| 1000+ Rice Growers | 1,436 | 2,110 | **68.1%** |
| Rice Acres | 1,552,076 | 2,265,551 | **68.5%** |

### By state

| State | Rice Growers | Rice Acres |
|---|---:|---:|
| Arkansas | 1,088 | 1,121,732 |
| Louisiana | 348 | 430,344 |

The platform's UI states "Central Arkansas = 62% of market" for Rice — consistent with AR alone holding 1,088 / 2,110 = 51.6% of growers and 1,121,732 / 2,265,551 = 49.5% of acres. The 62% figure likely reflects the platform's combined density score (growers × acres or similar), which weighs both metrics.

## Field availability per Rice-zone point layer

| Layer | Records | Optional Field Completeness |
|---|---:|---|
| FSS Grain | 83 | address: 98.8%, **capacity: 94.0%** |
| FSS Flour Mills | 2 | address: 100%, capacity: 50% |
| FSS Specialty Mills | 23 | address: 100%, **capacity: 34.8%** ← weak |
| FSS Mix Plants | 1 | address: 100% |
| Terminals Rough Rice | 21 | capacity: 100%, commodity: 100% |
| Grain Elevators | 134 | address: 97.8% |
| CLS Customer Head Sheds | 70 | customer_name: 100%, ship_to_name: 100% |
| Grain Fumigation | 1 | type: 100%, region: 100% |

## Rice zone — strengths and gaps

### Strengths
- **Highest market concentration of any commodity in the platform**: 68% of US rice growers and acres in just 2 states.
- **100% of US Terminals Rough Rice** is in AR (21 of 21).
- All core supply chain layers represented: 134 Grain Elevators, 70 CLS Head Sheds, 21 Rough Rice Terminals.
- **Once PR #1 is deployed**: Rice Commercial co-ops (Riceland, Supreme, Producers) and Nutrien Locations will significantly increase point-layer density in the zone — adding ~95+ records concentrated in AR/LA.

### Gaps
- **FSS Flour Mills, Mix Plants, Fumigation are sparse** (2, 1, 1 records). Not necessarily a data gap — may reflect actual market structure (rice is processed differently from wheat).
- **FSS Specialty Mills capacity only 35% populated** — biggest field-completeness gap in the rice zone.
- **No layer has phone, email, or contact-level data** — this is consistent across the platform (all data is location/operation-level, not individual).
- **MS, MO, TX rice production excluded** — there are 32% of US rice growers and 31.5% of US rice acres outside AR+LA, which the displayed Win Zones don't capture. Producers Rice Mill (post-deploy) actually has locations in MS, suggesting expansion into MS could surface a third zone.

---

# 🌐 Combined Wheat + Rice Ecosystem Notes

## Layers shared between both market presets

These 7 layers are active in **both** Wheat and Rice market views:
- CLS Customer Head Sheds
- FSS Flour Mills
- FSS Grain
- FSS Mix Plants
- FSS Specialty Mills
- Grain Elevators
- Grain Fumigation

## Wheat-only layers
- CHS Grain
- MKC Grain
- McGregor Locations
- Terminals HRS Wheat
- Terminals HRW Wheat
- Terminals SRW Wheat

## Rice-only layers
- Nutrien Locations *(post-deploy)*
- Producers Rice Mill *(post-deploy)*
- Riceland Co-op *(post-deploy)*
- Supreme Rice *(post-deploy)*
- Terminals Rough Rice

## Geographic overlap
Wheat and Rice zones are **geographically disjoint** (no state appears in both audit scopes). This means data assets serving both markets (FSS Grain, Grain Elevators, CLS Head Sheds, Grain Fumigation) split across distinct regions; there's no shared county-level coverage to dedupe.

## Data attribute inventory (across all layers in this audit)

Fields that appear in at least one layer:
- **Identity / labeling:** name, customer_name, ship_to_name, division, type, region, commodity
- **Geography:** city, state, address, zip, lat, lon
- **Operational:** capacity

Fields that **do not exist** in the dataset (often requested but unavailable):
- First Name, Last Name (no person-level records)
- Phone, Email (no contact info)
- Acreage at the record level (only county-aggregate density)
- Crop Type, Operation Type, Ownership Type (not collected)
- Customer Status, Dealer Alignment, Distribution Role (not collected)

## Strategic observations

1. **Rice market is geographically concentrated**; Wheat is dispersed. Rice activation can target 2 states; Wheat needs at least 9.
2. **Layer enrichment opportunity (Wheat):** the SRW Terminal layer is meaningful nationally (61 records) but not represented in the displayed Win Zones — either expand the Wheat zones to include SRW geography (IL/IN/KY/MI/OH) or accept the structural mismatch.
3. **Layer enrichment opportunity (Rice):** post-PR #1 deploy adds ~95 new records concentrated in AR+LA. Future expansion: ingest MS rice mills (e.g., Producers expanded into MS) and consider a third Rice zone.
4. **Field enrichment opportunity:** Capacity is the weakest field across FSS layers (35% complete on Specialty Mills); fixing that single field would meaningfully improve operational targeting.
5. **No contact-level data anywhere** — if person-level outreach is the activation goal, the current dataset can't support it. Closest is `customer_name` on 1,047 CLS Head Sheds (org-level, not individual).
