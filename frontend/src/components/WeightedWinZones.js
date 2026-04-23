import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Crosshair, Eye, EyeOff, Settings2 } from 'lucide-react';

// ─── SCORING CONFIG ────────────────────────────────────────────

const LAYER_WEIGHTS = {
  'CLS Customer Head Sheds': 10,
  'Grain Elevators': 6,
  'Grain Fumigation': 7,
  'Feed Manufacturers': 5,
  'Feed Stores': 4,
  'Pest Control': 5,
  'FSS Grain': 4, 'FSS Flour Mills': 4, 'FSS Specialty Mills': 4, 'FSS Mix Plants': 4,
  'CHS Grain': 4, 'CHS Agronomy': 4,
  'Terminals SRW Wheat': 4, 'Terminals HRW Wheat': 4, 'Terminals HRS Wheat': 4,
  'Terminals Corn & Soybean': 4, 'Terminals Rough Rice': 4, 'Terminals Oats': 4,
  'Terminals Soybean Oil': 4, 'Terminals Soybean Meal': 4,
};

// Which point layers are relevant per market
const CROP_ACCESS_LAYERS = {
  wheat: ['CLS Customer Head Sheds', 'Grain Elevators', 'Grain Fumigation',
    'FSS Grain', 'FSS Flour Mills', 'FSS Specialty Mills', 'FSS Mix Plants',
    'Terminals SRW Wheat', 'Terminals HRW Wheat', 'Terminals HRS Wheat', 'CHS Grain'],
  rice: ['CLS Customer Head Sheds', 'Grain Elevators', 'Grain Fumigation',
    'FSS Grain', 'FSS Flour Mills', 'FSS Specialty Mills', 'FSS Mix Plants',
    'Terminals Rough Rice', 'CHS Grain'],
  corn: ['CLS Customer Head Sheds', 'Grain Elevators', 'Grain Fumigation',
    'FSS Grain', 'FSS Specialty Mills', 'FSS Mix Plants',
    'Terminals Corn & Soybean', 'CHS Grain', 'Feed Manufacturers'],
  hogs: ['CLS Customer Head Sheds', 'Feed Manufacturers', 'Feed Stores',
    'Terminals Corn & Soybean', 'Terminals Soybean Oil', 'Terminals Soybean Meal'],
  pest: ['CLS Customer Head Sheds', 'Pest Control', 'Grain Elevators', 'Grain Fumigation'],
};

// Which density layer = opportunity per market
const OPPORTUNITY_LAYER = {
  wheat: 'Wheat Acres', rice: 'Rice Acres', corn: 'Corn Acres',
  hogs: '1000+ Hogs', pest: 'Pest Control',
};

// Which grower layer for efficiency per market
const GROWER_LAYER = {
  wheat: '1000+ Wheat Growers', rice: '1000+ Rice Growers', corn: '1000+ Corn Growers',
  hogs: null, pest: null,
};

const DEFAULT_CONSTANTS = {
  wheat: { requiredGrowers: 137, impressions: 915 },
  corn:  { requiredGrowers: 16,  impressions: 108 },
  rice:  { requiredGrowers: 23,  impressions: 150 },
};

const DEFAULT_WEIGHTS = { opportunity: 0.6, access: 0.3, efficiency: 0.1 };

// ─── HELPERS ───────────────────────────────────────────────────

const quickDist = (lat1, lon1, lat2, lon2) => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + dLon * dLon);
};

const formatNum = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  return v.toLocaleString();
};

const getSimpleCentroid = (geometry) => {
  let coords = [];
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates[0][0];
  if (coords.length === 0) return null;
  let sLon = 0, sLat = 0;
  for (const c of coords) { sLon += c[0]; sLat += c[1]; }
  return [sLon / coords.length, sLat / coords.length];
};

const nameCluster = (counties) => {
  const stateCounts = {};
  counties.forEach(c => { stateCounts[c.state] = (stateCounts[c.state] || 0) + 1; });
  const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0][0];
  let avgLat = 0, avgLon = 0;
  counties.forEach(c => { avgLat += c.lat; avgLon += c.lon; });
  avgLat /= counties.length; avgLon /= counties.length;
  const stateCounties = counties.filter(c => c.state === dominantState);
  let sAvgLat = 0, sAvgLon = 0;
  stateCounties.forEach(c => { sAvgLat += c.lat; sAvgLon += c.lon; });
  sAvgLat /= stateCounties.length; sAvgLon /= stateCounties.length;
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
  if (secondState && stateCounts[secondState] > counties.length * 0.3) name += ` / ${secondState}`;
  return { name, lat: avgLat, lon: avgLon };
};

// ─── COMPONENT ─────────────────────────────────────────────────

const WeightedWinZones = ({
  enrichedFeatures,
  activeMarket,         // 'wheat' | 'rice' | 'corn' | 'hogs' | 'pest' | 'custom' | null
  selectedStates,
  zoneFocus = 'regional',
  locationData,
  modelWeights = DEFAULT_WEIGHTS,
  efficiencyConstants = {},
  onZonesComputed,
  onZoomToZone,
}) => {
  const [expandedZone, setExpandedZone] = React.useState(null);
  const [showAllZones, setShowAllZones] = React.useState(false);
  const [zoneVisibility, setZoneVisibility] = React.useState({});

  const market = (activeMarket && activeMarket !== 'custom') ? activeMarket : 'wheat';
  const hasEfficiency = ['wheat', 'corn', 'rice'].includes(market);
  const constants = efficiencyConstants[market] || DEFAULT_CONSTANTS[market] || null;

  const zones = useMemo(() => {
    if (!enrichedFeatures || enrichedFeatures.length === 0) return [];

    const oppLayer = OPPORTUNITY_LAYER[market];
    const growerLayer = GROWER_LAYER[market];
    const accessLayers = CROP_ACCESS_LAYERS[market] || [];

    // ── Score each county ──
    const scored = enrichedFeatures
      .map(f => {
        const centroid = getSimpleCentroid(f.geometry);
        if (!centroid) return null;
        const lat = centroid[1], lon = centroid[0];
        const densityLayers = JSON.parse(f.properties.density_layers || '{}');
        const stateName = f.properties.state_name;
        const countyName = f.properties.NAME;

        if (selectedStates && selectedStates.length > 0 && !selectedStates.includes(stateName)) return null;

        // 1) Opportunity
        let opportunityRaw = densityLayers[oppLayer] || 0;

        // 2) Access — count weighted point locations within ~30mi
        let accessRaw = 0;
        const layerCounts = {};
        (locationData || []).forEach(loc => {
          if (!accessLayers.includes(loc.layer)) return;
          const d = quickDist(lat, lon, loc.lat, loc.lon);
          if (d < 20) {
            const w = LAYER_WEIGHTS[loc.layer] || 1;
            accessRaw += w;
            layerCounts[loc.layer] = (layerCounts[loc.layer] || 0) + 1;
          }
        });

        // Synergy multipliers
        const hasCLS = (layerCounts['CLS Customer Head Sheds'] || 0) > 0;
        const hasGrowers = growerLayer ? (densityLayers[growerLayer] || 0) > 0 : false;
        const hasElevators = (layerCounts['Grain Elevators'] || 0) > 0;
        const hasFumigation = (layerCounts['Grain Fumigation'] || 0) > 0;
        const hasFSS = Object.keys(layerCounts).some(k => k.startsWith('FSS'));
        const hasCHS = Object.keys(layerCounts).some(k => k.startsWith('CHS'));

        if (hasCLS && hasGrowers) accessRaw *= 1.5;
        if (hasElevators && hasFumigation) accessRaw *= 1.3;
        if (hasFSS && hasCHS) accessRaw *= 1.2;

        // 3) Efficiency (only for wheat/corn/rice with constants)
        let efficiencyRaw = 0;
        if (hasEfficiency && constants) {
          const availableGrowers = growerLayer ? (densityLayers[growerLayer] || 0) : 0;
          const accessPoints = Object.values(layerCounts).reduce((s, v) => s + v, 0);
          if (accessPoints > 0) {
            const costToWin = constants.impressions / accessPoints;
            efficiencyRaw = 1 / costToWin; // higher = better
          }
        }

        // People count for top-10 display
        let peopleCount = 0;
        const peopleLayers = {};
        if (growerLayer && densityLayers[growerLayer]) {
          peopleLayers[growerLayer] = densityLayers[growerLayer];
          peopleCount += densityLayers[growerLayer];
        }
        Object.entries(layerCounts).forEach(([l, c]) => {
          peopleLayers[l] = c;
          peopleCount += c;
        });

        return {
          id: `${stateName}|${countyName}`,
          county: countyName, state: stateName,
          lat, lon, densityLayers,
          opportunityRaw, accessRaw, efficiencyRaw,
          layerCounts, peopleCount, peopleLayers,
        };
      })
      .filter(c => c && (c.opportunityRaw > 0 || c.accessRaw > 0));

    if (scored.length === 0) return [];

    // ── Normalize ──
    const maxOpp = Math.max(...scored.map(c => c.opportunityRaw), 1);
    const maxAcc = Math.max(...scored.map(c => c.accessRaw), 1);
    const maxEff = Math.max(...scored.map(c => c.efficiencyRaw), 0.001);

    const wOpp = modelWeights.opportunity;
    const wAcc = modelWeights.access;
    const wEff = hasEfficiency ? modelWeights.efficiency : 0;
    const wTotal = wOpp + wAcc + wEff;

    scored.forEach(c => {
      const normOpp = c.opportunityRaw / maxOpp;
      const normAcc = c.accessRaw / maxAcc;
      const normEff = hasEfficiency ? c.efficiencyRaw / maxEff : 0;
      c.finalScore = ((normOpp * wOpp) + (normAcc * wAcc) + (normEff * wEff)) / wTotal;
      c.scores = { opportunity: normOpp, access: normAcc, efficiency: normEff };
    });

    // ── Cluster (same state-seeded method) ──
    const FOCUS_SETTINGS = {
      local: { mergeDist: 40, maxSize: 25 },
      regional: { mergeDist: 100, maxSize: 60 },
      territory: { mergeDist: 150, maxSize: 100 },
    };
    const { mergeDist, maxSize } = FOCUS_SETTINGS[zoneFocus] || FOCUS_SETTINGS.regional;

    // Group by state, rank by total finalScore
    const stateGroups = {};
    scored.forEach(c => {
      if (!stateGroups[c.state]) stateGroups[c.state] = { total: 0, counties: [] };
      stateGroups[c.state].total += c.finalScore;
      stateGroups[c.state].counties.push(c);
    });
    const rankedStates = Object.entries(stateGroups)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([state]) => state);

    const used = new Set();
    const allClusters = [];
    for (const state of rankedStates) {
      const stateCounties = stateGroups[state].counties
        .filter(c => !used.has(c.id))
        .sort((a, b) => b.finalScore - a.finalScore);
      if (stateCounties.length === 0) continue;
      const seed = stateCounties[0];
      if (used.has(seed.id)) continue;
      const cluster = [seed];
      used.add(seed.id);
      let changed = true;
      while (changed && cluster.length < maxSize) {
        changed = false;
        for (const cand of scored) {
          if (used.has(cand.id) || cluster.length >= maxSize) continue;
          for (const member of cluster) {
            if (quickDist(member.lat, member.lon, cand.lat, cand.lon) < mergeDist) {
              cluster.push(cand); used.add(cand.id); changed = true; break;
            }
          }
        }
      }
      if (cluster.length >= 3) allClusters.push(cluster);
    }

    // Rank by total finalScore
    const sortedClusters = allClusters.sort((a, b) => {
      return b.reduce((s, c) => s + c.finalScore, 0) - a.reduce((s, c) => s + c.finalScore, 0);
    });

    return sortedClusters.slice(0, 5).map((cluster, idx) => {
      const { name, lat, lon } = nameCluster(cluster);
      const avgScore = cluster.reduce((s, c) => s + c.finalScore, 0) / cluster.length;
      const avgOpp = cluster.reduce((s, c) => s + c.scores.opportunity, 0) / cluster.length;
      const avgAcc = cluster.reduce((s, c) => s + c.scores.access, 0) / cluster.length;
      const avgEff = cluster.reduce((s, c) => s + c.scores.efficiency, 0) / cluster.length;

      const lats = cluster.map(c => c.lat), lons = cluster.map(c => c.lon);
      const bbox = {
        minLat: Math.min(...lats) - 0.5, maxLat: Math.max(...lats) + 0.5,
        minLon: Math.min(...lons) - 0.5, maxLon: Math.max(...lons) + 0.5,
      };

      // Top 10 counties by people count
      const topCounties = [...cluster]
        .sort((a, b) => b.peopleCount - a.peopleCount)
        .slice(0, 10)
        .map(c => ({
          name: `${c.county}, ${c.state}`,
          peopleTotal: c.peopleCount,
          score: Math.round(c.finalScore * 100),
          layers: c.peopleLayers,
        }));

      return {
        id: idx, name,
        countyCount: cluster.length,
        score: Math.round(avgScore * 100),
        scores: { opportunity: Math.round(avgOpp * 100), access: Math.round(avgAcc * 100), efficiency: Math.round(avgEff * 100) },
        lat, lon, bbox,
        countyIds: cluster.map(c => c.id),
        topCounties,
      };
    });
  }, [enrichedFeatures, market, selectedStates, zoneFocus, locationData, modelWeights, efficiencyConstants, hasEfficiency, constants]);

  // Default: zones 4+ hidden
  React.useEffect(() => {
    if (zones.length > 0) {
      setZoneVisibility(prev => {
        const next = { ...prev };
        zones.forEach((_, idx) => { if (idx >= 3 && !(idx in prev)) next[idx] = false; });
        return next;
      });
    }
  }, [zones]);

  // Emit visible zones for map
  React.useEffect(() => {
    if (onZonesComputed) {
      onZonesComputed(zones.filter((_, idx) => zoneVisibility[idx] !== false));
    }
  }, [zones, zoneVisibility, onZonesComputed]);

  if (zones.length === 0) return null;

  const visibleCount = showAllZones ? zones.length : Math.min(3, zones.length);
  const hasMore = zones.length > 3;

  return (
    <div className="space-y-2" data-testid="weighted-win-zone-cards">
      {zones.slice(0, visibleCount).map((zone, idx) => {
        const isExpanded = expandedZone === idx;
        const isVisible = zoneVisibility[idx] !== false;

        return (
          <div key={idx} className={`rounded-lg border border-cyan-200 bg-cyan-50/50 overflow-hidden ${!isVisible ? 'opacity-40' : ''}`} data-testid={`weighted-zone-card-${idx}`}>
            <div
              onClick={() => setExpandedZone(isExpanded ? null : idx)}
              className="w-full px-3 py-2.5 flex items-start gap-2 text-left cursor-pointer bg-cyan-100/50"
            >
              <span className="text-sm font-bold text-cyan-700 mt-0.5">#{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-900 leading-tight">{zone.name}</div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {zone.countyCount} counties · Score: {zone.score}%
                </div>
                {/* Score breakdown bar */}
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-amber-400" style={{ width: `${zone.scores.opportunity}%` }} title={`Opportunity: ${zone.scores.opportunity}%`} />
                    <div className="h-full bg-cyan-500" style={{ width: `${zone.scores.access}%` }} title={`Access: ${zone.scores.access}%`} />
                    {hasEfficiency && <div className="h-full bg-emerald-500" style={{ width: `${zone.scores.efficiency}%` }} title={`Efficiency: ${zone.scores.efficiency}%`} />}
                  </div>
                </div>
                <div className="flex gap-2 mt-0.5 text-[9px]">
                  <span className="text-amber-600">Opp {zone.scores.opportunity}%</span>
                  <span className="text-cyan-600">Acc {zone.scores.access}%</span>
                  {hasEfficiency && <span className="text-emerald-600">Eff {zone.scores.efficiency}%</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setZoneVisibility(prev => ({ ...prev, [idx]: prev[idx] === false ? true : false })); }}
                  className={`p-1 rounded transition-colors ${isVisible ? 'hover:bg-white/60 text-stone-500' : 'hover:bg-white/60 text-stone-300'}`}
                  title={isVisible ? 'Hide on map' : 'Show on map'}
                  data-testid={`weighted-zone-visibility-${idx}`}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onZoomToZone?.(zone); }}
                  className="p-1 rounded hover:bg-white/60 transition-colors"
                  data-testid={`weighted-zoom-zone-${idx}`}
                >
                  <Crosshair className="w-3.5 h-3.5 text-stone-500" />
                </button>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 text-stone-400" />}
              </div>
            </div>

            {isExpanded && (
              <div className="px-3 py-2 space-y-2">
                {zone.topCounties && zone.topCounties.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 mb-1">Top 10 Counties</div>
                    {zone.topCounties.map((tc, tcIdx) => (
                      <div key={tcIdx} className="mb-1.5 last:mb-0">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] font-medium text-stone-800">{tc.name}</span>
                          <span className="text-[10px] font-semibold text-stone-600">{formatNum(tc.peopleTotal)}</span>
                        </div>
                        {Object.keys(tc.layers).length > 0 && (
                          <div className="flex flex-wrap gap-x-3 mt-0.5">
                            {Object.entries(tc.layers).map(([l, v]) => (
                              <span key={l} className="text-[9px] text-stone-400">
                                {l}: <span className="text-stone-600">{formatNum(v)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={() => setShowAllZones(v => !v)}
          className="w-full text-center text-[10px] text-stone-400 hover:text-stone-600 py-1"
          data-testid="weighted-show-all-zones"
        >
          {showAllZones ? 'Show less' : `Show all ${zones.length} zones`}
        </button>
      )}
    </div>
  );
};

export default WeightedWinZones;
