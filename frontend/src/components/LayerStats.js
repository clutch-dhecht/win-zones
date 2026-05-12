import React, { useMemo, useState, useEffect } from 'react';
import { LAYER_GROUPS } from '../config/layerConfig';

// Format large numbers: 37118790 → "37.1M", 25711 → "25,711", 63 → "63"
const formatStat = (value) => {
  if (value >= 1000000) {
    const m = value / 1000000;
    return m >= 10 ? `${Math.round(m)}M+` : `${m.toFixed(1)}M`;
  }
  return value.toLocaleString();
};

const LayerStats = ({ activeLayers, pointData, locationData, densityData, onLayerToggle, onLayerHideOthers, onLayerResetMarket }) => {
  const [menu, setMenu] = useState(null);  // { layer, x, y } | null

  // Close menu on any outside click / Escape
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const stats = useMemo(() => {
    const result = [];

    // Build a map of layer -> summary-group key (only for groups marked summary: 'group')
    const layerToSummaryGroup = {};
    Object.entries(LAYER_GROUPS).forEach(([groupKey, group]) => {
      if (group.summary === 'group') {
        (group.layers || []).forEach(l => { layerToSummaryGroup[l] = { groupKey, label: group.label }; });
      }
    });

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
    // For summary-groups: roll sub-layers into a single card keyed by group label
    const locationCounts = {};
    const groupedCounts = {};
    (locationData || []).forEach(loc => {
      if (!activeLayers[loc.layer]) return;
      const grp = layerToSummaryGroup[loc.layer];
      if (grp) {
        groupedCounts[grp.label] = (groupedCounts[grp.label] || 0) + 1;
      } else {
        locationCounts[loc.layer] = (locationCounts[loc.layer] || 0) + 1;
      }
    });

    Object.entries(locationCounts).forEach(([layer, count]) => {
      if (count > 0) result.push({ layer, value: count });
    });
    Object.entries(groupedCounts).forEach(([label, count]) => {
      if (count > 0) result.push({ layer: label, value: count });
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
    <>
      <div className={`grid ${cols} gap-1.5`} data-testid="layer-stats">
        {stats.map(({ layer, value }) => {
          const clickable = typeof onLayerToggle === 'function';
          return (
            <button
              key={layer}
              type="button"
              onClick={clickable ? () => onLayerToggle(layer) : undefined}
              onContextMenu={clickable ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ layer, x: e.clientX, y: e.clientY });
              } : undefined}
              className={`bg-stone-50 border border-stone-200 rounded-lg px-2 py-2 text-center transition-all w-full ${
                clickable ? 'cursor-pointer hover:bg-stone-100 hover:border-stone-300 active:scale-95' : ''
              }`}
              data-testid={`stat-${layer}`}
              title={clickable ? `Click to hide. Right-click for more options.` : undefined}
            >
              <div className="text-lg font-bold leading-tight tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#D15E13' }}>
                {formatStat(value)}
              </div>
              <div className="text-[9px] text-stone-600 mt-0.5 leading-tight font-medium">
                {layer}
              </div>
            </button>
          );
        })}
      </div>
      {menu && (
        <div
          className="fixed z-50 bg-white border border-stone-200 rounded-lg shadow-lg py-1 text-xs min-w-[180px]"
          style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 130) }}
          onClick={(e) => e.stopPropagation()}
          data-testid="layer-context-menu"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100 truncate">{menu.layer}</div>
          <button
            type="button"
            onClick={() => { onLayerToggle && onLayerToggle(menu.layer); setMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 text-stone-700"
            data-testid="ctx-hide-only"
          >
            Hide only this
          </button>
          <button
            type="button"
            onClick={() => { onLayerHideOthers && onLayerHideOthers(menu.layer); setMenu(null); }}
            disabled={typeof onLayerHideOthers !== 'function'}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:hover:bg-transparent"
            data-testid="ctx-hide-others"
          >
            Hide all others
          </button>
          <button
            type="button"
            onClick={() => { onLayerResetMarket && onLayerResetMarket(); setMenu(null); }}
            disabled={typeof onLayerResetMarket !== 'function'}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:hover:bg-transparent border-t border-stone-100 mt-1"
            data-testid="ctx-reset-market"
          >
            Reset to market default
          </button>
        </div>
      )}
    </>
  );
};

export default LayerStats;
