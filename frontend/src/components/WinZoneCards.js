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
const clusterCounties = (counties) => {
  if (counties.length === 0) return [];

  // Sort by score descending
  const sorted = [...counties].sort((a, b) => b.score - a.score);
  const used = new Set();
  const clusters = [];
  const MERGE_DIST = 80; // miles — merge counties within this distance for contiguous zones

  for (const county of sorted) {
    if (used.has(county.id)) continue;

    // Start a new cluster from this seed
    const cluster = [county];
    used.add(county.id);

    // Expand: find all nearby high-scoring counties and merge them in
    // Cap at 40 counties to keep zones as actionable regional blocks
    let changed = true;
    while (changed && cluster.length < 40) {
      changed = false;
      for (const candidate of sorted) {
        if (used.has(candidate.id)) continue;
        if (cluster.length >= 40) break;
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
  selectedState,
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
        if (selectedState && f.properties.state_name !== selectedState) return false;
        return true;
      })
      .map(f => {
        const centroid = getSimpleCentroid(f.geometry);
        return {
          id: `${f.properties.state_name}|${f.properties.NAME}`,
          county: f.properties.NAME,
          state: f.properties.state_name,
          score: f.properties[scoreKey],
          nearestMiles: f.properties.nearest_point_miles,
          densityLayers: JSON.parse(f.properties.density_layers || '{}'),
          lat: centroid ? centroid[1] : 0,
          lon: centroid ? centroid[0] : 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Cluster into contiguous zones
    const clusters = clusterCounties(candidates);

    // Build zone objects from top 3 clusters — prefer big, high-scoring zones
    // Score clusters by: average score × log(county count) to balance size and quality
    const sortedClusters = clusters
      .filter(c => c.length >= 3) // Minimum 3 counties for a meaningful zone
      .sort((a, b) => {
        const avgA = a.reduce((s, c) => s + c.score, 0) / a.length;
        const avgB = b.reduce((s, c) => s + c.score, 0) / b.length;
        const rankA = avgA * Math.log(a.length + 1);
        const rankB = avgB * Math.log(b.length + 1);
        return rankB - rankA;
      });
    const topClusters = sortedClusters.slice(0, 3);

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

      return {
        id: idx,
        name,
        countyCount: cluster.length,
        score: Math.round(avgScore * 100),
        categorized,
        nearestCLS,
        lat, lon, bbox,
        counties,
        countyIds,
      };
    });
  }, [enrichedFeatures, activeLayers, winZonesMode, selectedState, locationData, pointData]);

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
        const scoreColor = isCoverage
          ? (zone.score >= 70 ? 'text-green-700' : 'text-green-500')
          : (zone.score >= 70 ? 'text-red-600' : 'text-orange-500');
        const bgColor = isCoverage ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50';
        const headerBg = isCoverage ? 'bg-green-100/50' : 'bg-orange-100/50';

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
                <div className="text-[10px] text-stone-400 mt-0.5">{zone.countyCount} counties · Score: {zone.score}%</div>
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

                {/* CLS Distribution */}
                {zone.nearestCLS && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 mb-0.5">CLS Distribution</div>
                    <div className="flex justify-between text-xs text-stone-600 py-0.5">
                      <span>Nearest Customer</span>
                      <span className="font-medium text-stone-800">
                        {zone.nearestCLS.city}, {zone.nearestCLS.state} ({zone.nearestCLS.dist}mi)
                      </span>
                    </div>
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
