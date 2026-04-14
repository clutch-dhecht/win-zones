import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Crosshair } from 'lucide-react';

// Layer categorization
const LAYER_CATEGORIES = {
  // Market Size (acreage / inventory)
  'Wheat Acres': 'market_size',
  'Corn Acres': 'market_size',
  'Rice Acres': 'market_size',
  '1000+ Hogs': 'market_size',
  // People to Reach (growers / operators)
  '1000+ Wheat Growers': 'people',
  '1000+ Corn Growers': 'people',
  '1000+ Rice Growers': 'people',
  'Farms with Grain Storage': 'people',
  'Pest Control': 'people',
  // Partners / Distribution
  'Grain Elevators': 'partners',
  'Feed Manufacturers': 'partners',
  'Feed Stores': 'partners',
  // CLS
  'CLS Customers': 'cls',
};

const CATEGORY_LABELS = {
  market_size: 'Market Size',
  people: 'People to Reach',
  partners: 'Partners / Distribution',
};

const formatNum = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  return v.toLocaleString();
};

// Cluster adjacent high-scoring counties into contiguous zones
// Uses grid-based spatial grouping: counties within ~75mi are merged
const clusterCounties = (counties, maxSize = 50, mergeDist = 80) => {
  if (counties.length === 0) return [];

  // Sort by score descending
  const sorted = [...counties].sort((a, b) => b.score - a.score);
  const used = new Set();
  const clusters = [];
  const MERGE_DIST = mergeDist;

  for (const county of sorted) {
    if (used.has(county.id)) continue;

    // Start a new cluster from this seed
    const cluster = [county];
    used.add(county.id);

    // Expand: find all nearby high-scoring counties and merge them in
    // Cap at 40 counties to keep zones as actionable regional blocks
    let changed = true;
    while (changed && cluster.length < maxSize) {
      changed = false;
      for (const candidate of sorted) {
        if (used.has(candidate.id)) continue;
        if (cluster.length >= maxSize) break;
        // Check if candidate is close to ANY county in this cluster
        for (const member of cluster) {
          const dist = quickDist(member.lat, member.lon, candidate.lat, candidate.lon);
          if (dist < MERGE_DIST) {
            cluster.push(candidate);
            used.add(candidate.id);
            changed = true;
            break;
          }
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
};

// Quick distance in miles using equirectangular approximation
const quickDist = (lat1, lon1, lat2, lon2) => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + dLon * dLon);
};

// Name a cluster based on its counties
const nameCluster = (counties) => {
  // Find dominant state
  const stateCounts = {};
  counties.forEach(c => {
    stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
  });
  const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0][0];

  // Get geographic center
  let avgLat = 0, avgLon = 0;
  counties.forEach(c => { avgLat += c.lat; avgLon += c.lon; });
  avgLat /= counties.length;
  avgLon /= counties.length;

  // Determine cardinal direction within state
  // Simple: compare to US center (39, -97)
  const stateCounties = counties.filter(c => c.state === dominantState);
  let sAvgLat = 0, sAvgLon = 0;
  stateCounties.forEach(c => { sAvgLat += c.lat; sAvgLon += c.lon; });
  sAvgLat /= stateCounties.length;
  sAvgLon /= stateCounties.length;

  // Use relative position within the state's counties to pick direction
  const allStLats = stateCounties.map(c => c.lat);
  const allStLons = stateCounties.map(c => c.lon);
  const midLat = (Math.min(...allStLats) + Math.max(...allStLats)) / 2;
  const midLon = (Math.min(...allStLons) + Math.max(...allStLons)) / 2;

  let dir = '';
  if (counties.length > 3) {
    const ns = sAvgLat > midLat + 0.3 ? 'North' : sAvgLat < midLat - 0.3 ? 'South' : '';
    const ew = sAvgLon > midLon + 0.3 ? 'East' : sAvgLon < midLon - 0.3 ? 'West' : 'Central';
    dir = ns ? `${ns}${ew !== 'Central' ? ew : ''}` : ew;
  }

  const multiState = Object.keys(stateCounts).length > 1;
  const secondState = multiState ? Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[1]?.[0] : null;

  let name = dir ? `${dir} ${dominantState}` : dominantState;
  if (secondState && stateCounts[secondState] > counties.length * 0.3) {
    name += ` / ${secondState}`;
  }

  return { name, dominantState, lat: avgLat, lon: avgLon };
};

const WinZoneCards = ({
  enrichedFeatures,
  activeLayers,
  winZonesMode,
  selectedStates,
  zoneFocus = 'regional',
  densityData,
  locationData,
  pointData,
  onZoomToZone,
  onZonesComputed,
}) => {
  const [expandedZone, setExpandedZone] = React.useState(null);

  const zones = useMemo(() => {
    if (!enrichedFeatures || enrichedFeatures.length === 0) return [];

    const isCoverage = winZonesMode === 'coverage';
    const scoreKey = isCoverage ? 'coverage_strength' : 'win_score';

    // Filter features to those with meaningful scores
    const candidates = enrichedFeatures
      .filter(f => {
        const score = f.properties[scoreKey] || 0;
        if (score < 0.05) return false;
        if (f.properties.density_total <= 0) return false;
        if (selectedStates && selectedStates.length > 0 && !selectedStates.includes(f.properties.state_name)) return false;
        return true;
      })
      .map(f => {
        const centroid = getSimpleCentroid(f.geometry);
        // Sum raw active density for this county
        const densityLayers = JSON.parse(f.properties.density_layers || '{}');
        let rawTotal = 0;
        Object.entries(densityLayers).forEach(([l, v]) => { if (activeLayers[l]) rawTotal += v; });

        return {
          id: `${f.properties.state_name}|${f.properties.NAME}`,
          county: f.properties.NAME,
          state: f.properties.state_name,
          score: f.properties[scoreKey],
          rawDensity: rawTotal,
          coveragePct: f.properties.coverage_pct || 0,
          nearestMiles: f.properties.nearest_point_miles,
          densityLayers,
          lat: centroid ? centroid[1] : 0,
          lon: centroid ? centroid[0] : 0,
        };
      })
      .sort((a, b) => {
        // Market mode: seed from highest raw density counties
        // Other modes: seed from highest score
        if (winZonesMode === 'market') return b.rawDensity - a.rawDensity;
        return b.score - a.score;
      });

    // Zone focus controls merge distance and max size
    const FOCUS_SETTINGS = {
      local:     { mergeDist: 30, maxSize: 15 },
      regional:  { mergeDist: 80, maxSize: 50 },
      territory: { mergeDist: 130, maxSize: 100 },
    };
    const { mergeDist, maxSize } = FOCUS_SETTINGS[zoneFocus] || FOCUS_SETTINGS.regional;

    // Cluster into contiguous zones
    const clusters = clusterCounties(candidates, maxSize, mergeDist);

    // Rank zones by total raw density — biggest markets win
    // Enforce geographic diversity: Zone 2 must be 200mi+ from Zone 1, Zone 3 from both
    const sortedClusters = clusters
      .filter(c => c.length >= 3)
      .sort((a, b) => {
        const totalA = a.reduce((s, c) => s + c.rawDensity, 0);
        const totalB = b.reduce((s, c) => s + c.rawDensity, 0);
        return totalB - totalA;
      });

    const MIN_ZONE_SEPARATION = 350; // miles between zone centers — forces distinct regions
    const topClusters = [];
    const zoneCenters = [];

    for (const cluster of sortedClusters) {
      if (topClusters.length >= 3) break;

      // Compute cluster center
      let cLat = 0, cLon = 0;
      cluster.forEach(c => { cLat += c.lat; cLon += c.lon; });
      cLat /= cluster.length;
      cLon /= cluster.length;

      // Check distance from existing zone centers
      const tooClose = zoneCenters.some(([zLat, zLon]) =>
        quickDist(cLat, cLon, zLat, zLon) < MIN_ZONE_SEPARATION
      );

      if (!tooClose) {
        topClusters.push(cluster);
        zoneCenters.push([cLat, cLon]);
      }
    }

    return topClusters.map((cluster, idx) => {
      const { name, dominantState, lat, lon } = nameCluster(cluster);
      const avgScore = cluster.reduce((s, c) => s + c.score, 0) / cluster.length;

      // Aggregate density layers across all counties in cluster
      const aggregatedLayers = {};
      cluster.forEach(c => {
        Object.entries(c.densityLayers).forEach(([layer, value]) => {
          if (activeLayers[layer]) {
            aggregatedLayers[layer] = (aggregatedLayers[layer] || 0) + value;
          }
        });
      });

      // Count point locations within this zone (using cluster bounding box + buffer)
      const lats = cluster.map(c => c.lat);
      const lons = cluster.map(c => c.lon);
      const bbox = {
        minLat: Math.min(...lats) - 0.5,
        maxLat: Math.max(...lats) + 0.5,
        minLon: Math.min(...lons) - 0.5,
        maxLon: Math.max(...lons) + 0.5,
      };

      const pointCounts = {};
      (locationData || []).forEach(loc => {
        if (!activeLayers[loc.layer]) return;
        if (loc.lat >= bbox.minLat && loc.lat <= bbox.maxLat &&
            loc.lon >= bbox.minLon && loc.lon <= bbox.maxLon) {
          pointCounts[loc.layer] = (pointCounts[loc.layer] || 0) + 1;
        }
      });

      // Find nearest CLS Customer
      let nearestCLS = null;
      (pointData || []).forEach(city => {
        const clsCount = city.layers?.['CLS Customers'] || 0;
        if (clsCount <= 0) return;
        const dist = quickDist(lat, lon, city.lat, city.lon);
        if (!nearestCLS || dist < nearestCLS.dist) {
          nearestCLS = { city: city.city, state: city.state, dist: Math.round(dist) };
        }
      });

      // Categorize
      const categorized = { market_size: {}, people: {}, partners: {} };
      Object.entries(aggregatedLayers).forEach(([layer, value]) => {
        const cat = LAYER_CATEGORIES[layer] || 'market_size';
        if (cat !== 'cls') categorized[cat][layer] = value;
      });
      Object.entries(pointCounts).forEach(([layer, count]) => {
        const cat = LAYER_CATEGORIES[layer] || 'partners';
        if (cat !== 'cls') categorized[cat][layer] = count;
      });

      const countyIds = cluster.map(c => c.id); // "State|COUNTY" IDs for map outlines
      const counties = cluster.map(c => `${c.county}, ${c.state}`);

      // Average coverage across zone (0-1)
      const avgCoverage = cluster.reduce((s, c) => s + c.coveragePct, 0) / cluster.length;
      const coveragePctRound = Math.round(avgCoverage * 100);
      const coverageLabel = coveragePctRound >= 60 ? 'Deepen' : coveragePctRound >= 25 ? 'Fill gaps' : 'Expand';

      return {
        id: idx,
        name,
        countyCount: cluster.length,
        score: Math.round(avgScore * 100),
        categorized,
        lat, lon, bbox,
        counties,
        countyIds,
        coveragePct: coveragePctRound,
        coverageLabel,
      };
    });
  }, [enrichedFeatures, activeLayers, winZonesMode, selectedStates, zoneFocus, locationData, pointData]);

  // Emit zones for map outlines
  React.useEffect(() => {
    if (onZonesComputed) onZonesComputed(zones);
  }, [zones, onZonesComputed]);

  if (zones.length === 0) return null;

  const isCoverage = winZonesMode === 'coverage';

  return (
    <div className="space-y-2" data-testid="win-zone-cards">
      {zones.map((zone, idx) => {
        const isExpanded = expandedZone === idx;
        const isMarket = winZonesMode === 'market';
        const scoreColor = isCoverage
          ? (zone.score >= 70 ? 'text-green-700' : 'text-green-500')
          : isMarket
          ? (zone.score >= 70 ? 'text-indigo-700' : 'text-indigo-500')
          : (zone.score >= 70 ? 'text-red-600' : 'text-orange-500');
        const bgColor = isCoverage ? 'border-green-200 bg-green-50/50' : isMarket ? 'border-indigo-200 bg-indigo-50/50' : 'border-orange-200 bg-orange-50/50';
        const headerBg = isCoverage ? 'bg-green-100/50' : isMarket ? 'bg-indigo-100/50' : 'bg-orange-100/50';

        return (
          <div key={idx} className={`rounded-lg border ${bgColor} overflow-hidden`} data-testid={`win-zone-card-${idx}`}>
            {/* Header - always visible */}
            <button
              onClick={() => setExpandedZone(isExpanded ? null : idx)}
              className={`w-full px-3 py-2.5 flex items-start gap-2 text-left ${headerBg}`}
            >
              <span className={`text-sm font-bold ${scoreColor} mt-0.5`}>#{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-900 leading-tight">{zone.name}</div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {zone.countyCount} counties{isMarket ? '' : ` · Score: ${zone.score}%`}
                </div>
                {/* Coverage bar — always show in market mode, optional in others */}
                {isMarket && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${zone.coveragePct >= 60 ? 'bg-green-500' : zone.coveragePct >= 25 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.max(zone.coveragePct, 3)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-medium ${zone.coveragePct >= 60 ? 'text-green-600' : zone.coveragePct >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                      {zone.coveragePct}% — {zone.coverageLabel}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onZoomToZone?.(zone); }}
                  className="p-1 rounded hover:bg-white/60 transition-colors"
                  title="View on map"
                  data-testid={`zoom-zone-${idx}`}
                >
                  <Crosshair className="w-3.5 h-3.5 text-stone-500" />
                </button>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 text-stone-400" />}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 py-2 space-y-2">
                {/* Market Size */}
                {Object.keys(zone.categorized.market_size).length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 mb-0.5">Market Size</div>
                    {Object.entries(zone.categorized.market_size).map(([layer, value]) => (
                      <div key={layer} className="flex justify-between text-xs text-stone-600 py-0.5">
                        <span>{layer}</span>
                        <span className="font-medium text-stone-800">{formatNum(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* People to Reach */}
                {Object.keys(zone.categorized.people).length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 mb-0.5">People to Reach</div>
                    {Object.entries(zone.categorized.people).map(([layer, value]) => (
                      <div key={layer} className="flex justify-between text-xs text-stone-600 py-0.5">
                        <span>{layer}</span>
                        <span className="font-medium text-stone-800">{formatNum(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Partners / Distribution */}
                {Object.keys(zone.categorized.partners).length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 mb-0.5">Partners / Distribution</div>
                    {Object.entries(zone.categorized.partners).map(([layer, value]) => (
                      <div key={layer} className="flex justify-between text-xs text-stone-600 py-0.5">
                        <span>{layer}</span>
                        <span className="font-medium text-stone-800">{formatNum(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* County list */}
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 mb-0.5">Counties</div>
                  <div className="text-[10px] text-stone-500 leading-relaxed">
                    {zone.counties.slice(0, 8).join(' · ')}
                    {zone.counties.length > 8 && ` +${zone.counties.length - 8} more`}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Simple centroid from GeoJSON geometry
const getSimpleCentroid = (geometry) => {
  let coords = [];
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates[0][0];
  if (coords.length === 0) return null;
  let sLon = 0, sLat = 0;
  for (const c of coords) { sLon += c[0]; sLat += c[1]; }
  return [sLon / coords.length, sLat / coords.length];
};

export default WinZoneCards;
