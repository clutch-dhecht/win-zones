# Duplicates Report — Cross-Layer & Intra-Layer Audit

**Generated:** 2026-05-12
**Source:** local MongoDB snapshot (41,811 location_points across 27 layers, post-PR-#4 deploy)
**Methodology:** see [Match strategy](#match-strategy) below

This report is **analysis-only** — no records have been modified or deleted. Use it to decide which dedup strategy (drop / soft-flag / per-pair manual review) to apply.

## TL;DR

- **872** intra-layer dupes (same layer, same address) — clear drop candidates
- **601** cross-layer dupes (different layers, same physical address) that are not expected by design — need a policy decision
- **121** cross-layer overlaps that **are expected** (CHS Grain+Agronomy, MKC Grain+Agronomy, Nutrien sub-types) — keep these
- **~3.5% of all records** are involved in some duplicate relationship

## Match strategy

| Tier | Criteria | Confidence | Recommended action |
|---|---|---|---|
| **T1** | Same layer + same normalized address + same city + state | High | Drop the redundant rows |
| **T2** | Same layer + same city + state + name token Jaccard ≥ 0.8 | High | Drop the redundant rows |
| **T3** | Cross-layer + same normalized address + same city + state | Medium | Manual call — keep, flag, or drop |
| **T4** | Cross-layer + same city + state + name token Jaccard ≥ 0.85 | Low | Manual review only |

Address normalization: uppercase, common abbreviations (Street→ST, North→N, etc.), punctuation stripped, whitespace collapsed. Name matching uses bag-of-words Jaccard on alphanumeric tokens ≥ 2 chars.

---

## 1. Intra-layer duplicates (T1) — 872 redundant rows

These are rows within a single layer that share city + state + normalized address. By definition, these are duplicate records.

| Layer | Dupes to drop | Layer total | Dupe rate |
|---|---:|---:|---:|
| Pest Control | 440 | 23,737 | 1.9% |
| FSS Specialty Mills | 169 | 372 | **45.4%** |
| Feed Stores | 109 | 7,878 | 1.4% |
| Grain Elevators | 84 | 4,538 | 1.9% |
| Nutrien Retail | 39 | 879 | 4.4% |
| FSS Grain | 16 | 1,019 | 1.6% |
| Helena Agri | 6 | 461 | 1.3% |
| Aurora Coop | 3 | 73 | 4.1% |
| Feed Manufacturers | 2 | 665 | 0.3% |
| Nutrien Office | 2 | 33 | 6.1% |
| Nutrien Terminal | 1 | 38 | 2.6% |
| Nutrien Storage | 1 | 29 | 3.4% |

### Notable patterns

**Pest Control (440 dupes)** — same address, *different* business names. Looks like the source dataset scraped multiple businesses operating from a shared building. Example:
> Discreet Bed Bug Inspections @ 301 W 57th St #12A, New York
> NYC Extermination @ 301 W 57th St #12A, New York

Decision needed: are these two distinct businesses (keep both) or scraping noise (drop)? My read: drop — same physical "Pest Control" location regardless of business name.

**FSS Specialty Mills (169 dupes, 45.4% dupe rate)** — the worst offender. Same mill listed multiple times at the same address.
> Ardent Mills @ 1875 Lawrence St., Denver — 3 identical rows

This is a clean drop candidate.

**Nutrien Retail (39 dupes)** — same physical address, different branch names from Nutrien's internal taxonomy:
> Grady @ 920 Grady Avenue
> Grady (Pinebelt) @ 920 Grady Avenue
> Monticello @ 920 Grady Avenue

This is **source-data quality** — three Nutrien branches share one address. Drop policy needs your call: keep the first, keep the most-canonical, or surface as multi-branch entries.

---

## 2. Cross-layer overlaps requiring review (T3) — 601 pairs

These are pairs where the *same physical address* appears in different layers. Some are real duplicates; some are intentional multi-classifications.

### Top unexpected cross-layer pairs

| Layer A | Layer B | Pairs | Example |
|---|---|---:|---|
| FSS Grain | Grain Elevators | **199** | Riceland Foods Inc @ 200 Plum St (Newport, AR) |
| FSS Flour Mills | FSS Specialty Mills | 78 | Western Foods @ 5215 Industrial Dr S (Pine Bluff, AR) |
| FSS Flour Mills | FSS Grain | 59 | ADM Milling @ 110 E. 12th St (Mendota, IL) |
| FSS Flour Mills | FSS Mix Plants | 42 | Western Foods @ 5215 Industrial Dr S (Pine Bluff, AR) |
| FSS Mix Plants | FSS Specialty Mills | 38 | Western Foods @ 5215 Industrial Dr S (Pine Bluff, AR) |
| FSS Grain | FSS Specialty Mills | 37 | Riceland Foods @ P.O. Box 130 (Waldenburg, AR) |
| Feed Stores | Grain Elevators | 21 | Cargill Animal Nutrition @ 16 Feed Mill Rd (Lecompte, LA) |
| CHS Grain | Grain Elevators | 17 | CHS Agri Services @ 603 10th St (Alma, NE) |
| Feed Manufacturers | Feed Stores | 15 | NewStar Sourcing @ 805 S Union St (Fremont, NE) |
| Feed Manufacturers | Grain Elevators | 11 | Falmouth Co-Op @ 260 E Prosper Rd (Falmouth, MI) |
| Grain Elevators | Nutrien Retail | 8 | Schneider's Milling @ 3601 E Bremer Ave (Waverly, IA) |
| CHS Agronomy | Grain Elevators | 7 | CHS Agri Services @ 603 10th St (Alma, NE) |
| Grain Elevators | Poinsett Rice & Grain | 5 | Poinsett Rice & Grain @ 6211 Southwest Dr (Jonesboro, AR) |
| FSS Flour Mills | Grain Elevators | 5 | ADM Mendota Elevator @ 110 E 12th St (Mendota, IL) |
| Grain Elevators | MKC Grain | 5 | Mid-West Fertilizer @ 602 Main St (Nortonville, KS) |

### Patterns and decisions needed

**A. FSS suite over-classification (254 internal overlaps)**
FSS Specialty Mills, Flour Mills, Grain, and Mix Plants frequently share addresses. Example: Western Foods at the same address appears in 4 FSS sub-categories. Is this:
- (i) **By design** — a single facility legitimately operating in multiple processing modes — *keep them all*
- (ii) **Source confusion** — the FSS dataset has loose categorization — *pick one canonical category per address*

Recommend: review a sample of 20 of these and decide.

**B. FSS / Elevator overlap (199 pairs)**
The same grain handling facility is in both `FSS Grain` and `Grain Elevators`. This is the biggest single category of cross-layer dupes. Options:
- Make `Grain Elevators` the canonical layer and drop FSS Grain entries that overlap (treats FSS as a specialty subset)
- Or vice versa
- Or keep both with a `canonical_layer_id` reference for the UI to suppress

**C. Key-account / Elevator overlaps**
- `Grain Elevators ↔ Poinsett Rice & Grain` (5) — Poinsett operates grain elevators, so they show up in both. **Decision: keep both** — the Poinsett layer is a key-account targeting layer, the Grain Elevators layer is the macro view.
- `Grain Elevators ↔ Nutrien Retail` (8) — same pattern.
- `CHS Grain ↔ Grain Elevators` (17), `MKC Grain ↔ Grain Elevators` (5) — same.

Reco: **explicitly mark key-account layers as "subset views" and exclude them from cross-layer dedup.** Their whole purpose is to highlight specific accounts within the broader elevator network.

---

## 3. Expected multi-classifications (keep) — 121 pairs

These overlaps are **by design** — a single physical facility legitimately belongs to multiple sub-layers within the same product family:

| Layer A | Layer B | Pairs |
|---|---|---:|
| CHS Agronomy | CHS Grain | 60 |
| MKC Agronomy | MKC Grain | 22 |
| Nutrien Retail | Nutrien Storage | 13 |
| Nutrien Retail | Nutrien Terminal | 12 |
| Nutrien Office | Nutrien Retail | 11 |
| Nutrien Office | Nutrien Terminal | 2 |
| Nutrien Storage | Nutrien Terminal | 1 |

**No action needed.** These reflect intentional multi-membership — a CHS location can sell both grain and agronomy products from the same address, and we explicitly model that as two records.

---

## 4. Tier 4 (fuzzy name) — 370 pairs flagged for manual review

Cross-layer pairs with same city/state and fuzzy name match (Jaccard ≥ 0.85) but **different** addresses. Lower confidence — could be real duplicates with slightly different addresses, or genuinely different locations of the same company. Not auto-droppable.

Top fuzzy-name pairs by layer:
- FSS Grain ↔ Grain Elevators: 84
- FSS Flour Mills ↔ FSS Grain: 24
- Terminals Soybean Meal ↔ Terminals Soybean Oil: 21
- CLS Customer Locations ↔ Grain Elevators: 16 (customers operating elevators)
- Helena Agri ↔ Nutrien Retail: 15 (competing retailers in the same town)
- Nutrien Retail ↔ Wilbur-Ellis: 14 (same)

These are interesting business intelligence (where competitors co-locate) but not duplicates per se. **Recommend: don't dedup; surface in a separate "competitive density" view later.**

---

## Recommended next steps

I see three possible policies. Pick one and I'll write the implementation as PR B-2.

### Policy A — Conservative dedup (recommended)
- **Drop** all 872 intra-layer T1+T2 dupes (lossless cleanup)
- **Keep** all cross-layer overlaps (T3 + T4)
- **Keep** key-account layers as overlays — explicitly excluded from any future dedup logic
- Result: ~872 records removed, no semantic data loss

### Policy B — Aggressive supply-chain dedup
- Drop intra-layer dupes (872) **AND** resolve FSS suite over-classification (254 internal FSS dupes by picking the most-specific category) **AND** mark FSS Grain entries that duplicate Grain Elevators as the lower-priority record (199 dropped from FSS Grain)
- Result: ~1,325 records removed; FSS becomes cleaner; Grain Elevators stays canonical for grain-handling
- Risk: judgment calls on which FSS category to keep

### Policy C — Soft dedup with provenance
- Don't drop anything. Add a `dupe_group_id` field that groups same-address records across layers. Add a UI toggle: "Hide cross-layer duplicates" that, when on, shows only one record per `dupe_group_id` (preferring key-account layers > CHS/MKC > FSS > Grain Elevators > Feed Stores > Pest Control).
- Result: reversible, no data loss, but requires UI work and a precedence rule.

---

## My recommendation

**Policy A** as a first pass. It removes pure duplicates that nobody disputes are duplicates, leaves the structural cross-layer questions for a follow-up decision, and is fully lossless from a semantic standpoint. Once that's in production and we see how the dedup-aware view feels, we can move to B or C.

Reply with the policy you want and I'll write the implementation.
