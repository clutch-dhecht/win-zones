import React, { useMemo } from 'react';

// Format large numbers: 37118790 → "37.1M", 25711 → "25,711", 63 → "63"
const formatStat = (value) => {
  if (value >= 1000000) {
    const m = value / 1000000;
    return m >= 10 ? `${Math.round(m)}M+` : `${m.toFixed(1)}M`;
  }
  return value.toLocaleString();
};

const LayerStats = ({ activeLayers, pointData, locationData, densityData }) => {
  const stats = useMemo(() => {
    const result = [];

    // Density layers: sum values across all counties
    const densityTotals = {};
    (densityData || []).forEach(county => {
      Object.entries(county.layers).forEach(([layer, value]) => {
        if (!activeLayers[layer]) return;
        densityTotals[layer] = (densityTotals[layer] || 0) + value;
      });
    });

    Object.entries(densityTotals).forEach(([layer, total]) => {
      if (total > 0) result.push({ layer, value: total });
    });

    // Individual location points: count per layer
    const locationCounts = {};
    (locationData || []).forEach(loc => {
      if (!activeLayers[loc.layer]) return;
      locationCounts[loc.layer] = (locationCounts[loc.layer] || 0) + 1;
    });

    Object.entries(locationCounts).forEach(([layer, count]) => {
      if (count > 0) result.push({ layer, value: count });
    });

    // Aggregated points (CLS Customers): sum values
    const aggTotals = {};
    (pointData || []).forEach(city => {
      Object.entries(city.layers).forEach(([layer, value]) => {
        if (!activeLayers[layer]) return;
        aggTotals[layer] = (aggTotals[layer] || 0) + value;
      });
    });

    Object.entries(aggTotals).forEach(([layer, total]) => {
      if (total > 0) result.push({ layer, value: total });
    });

    return result;
  }, [activeLayers, pointData, locationData, densityData]);

  if (stats.length === 0) return null;

  const cols = stats.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid ${cols} gap-1.5`} data-testid="layer-stats">
      {stats.map(({ layer, value }) => (
        <div
          key={layer}
          className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-2 text-center"
          data-testid={`stat-${layer}`}
        >
          <div className="text-lg font-bold text-stone-900 leading-tight tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {formatStat(value)}
          </div>
          <div className="text-[9px] text-stone-400 mt-0.5 leading-tight">
            {layer}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LayerStats;
