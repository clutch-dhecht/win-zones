import React, { useMemo, useState, useEffect } from 'react';
import { LAYER_GROUPS, LAYER_CONFIG } from '../config/layerConfig';

// Resolve the user-facing label for a layer or group. Uses LAYER_CONFIG.displayLabel
// (per-layer override) or falls back to the layer/group key.
const labelFor = (key) => {
  const cfg = LAYER_CONFIG[key];
  return (cfg && cfg.displayLabel) || key;
};

// Format large numbers: 37118790 → "37.1M", 25711 → "25,711", 63 → "63"
const formatStat = (value) => {
  if (value >= 1000000) {
    const m = value / 1000000;
    return m >= 10 ? `${Math.round(m)}M+` : `${m.toFixed(1)}M`;
  }
  return value.toLocaleString();
};

const LayerStats = ({
  activeLayers,
  pointData,
  locationData,
  densityData,
  onLayerToggle,
  onLayerHideOthers,
  onLayerResetMarket,
  presetLayers = null, // ordered list of layers in the active market preset; null = no preset
}) => {
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const stats = useMemo(() => {
    // Layer -> group summary metadata (only for groups marked summary: 'group')
    const layerToSummaryGroup = {};
    Object.entries(LAYER_GROUPS).forEach(([groupKey, group]) => {
      if (group.summary === 'group') {
        (group.layers || []).forEach(l => { layerToSummaryGroup[l] = { groupKey, label: group.label }; });
      }
    });

    // Decide which layers to render cards for: union of (preset layers) + (currently active layers)
    const cardLayerSet = new Set();
    (presetLayers || []).forEach(l => cardLayerSet.add(l));
    Object.keys(activeLayers || {}).forEach(l => { if (activeLayers[l]) cardLayerSet.add(l); });

    // Compute counts for all candidate layers, REGARDLESS of active state
    // (so greyed cards still show the count you'd get back)
    const counts = {};
    (densityData || []).forEach(county => {
      Object.entries(county.layers || {}).forEach(([layer, value]) => {
        if (cardLayerSet.has(layer)) counts[layer] = (counts[layer] || 0) + value;
      });
    });
    (locationData || []).forEach(loc => {
      if (cardLayerSet.has(loc.layer)) counts[loc.layer] = (counts[loc.layer] || 0) + 1;
    });
    (pointData || []).forEach(city => {
      Object.entries(city.layers || {}).forEach(([layer, value]) => {
        if (cardLayerSet.has(layer)) counts[layer] = (counts[layer] || 0) + value;
      });
    });

    // Walk in preset order so cards don't reorder when toggled
    const orderedLayers = [];
    (presetLayers || []).forEach(l => { if (!orderedLayers.includes(l)) orderedLayers.push(l); });
    // Append any active non-preset layers (user-added via Advanced panel)
    Object.keys(activeLayers || {}).forEach(l => {
      if (activeLayers[l] && !orderedLayers.includes(l)) orderedLayers.push(l);
    });

    // Build the cards, collapsing group sub-layers into their summary card
    const seen = new Set();
    const cards = [];
    orderedLayers.forEach(layer => {
      const grp = layerToSummaryGroup[layer];
      if (grp) {
        if (seen.has(grp.label)) return;
        seen.add(grp.label);
        const subs = LAYER_GROUPS[grp.groupKey].layers || [];
        const total = subs.reduce((s, sl) => s + (counts[sl] || 0), 0);
        const active = subs.some(sl => activeLayers[sl]);
        if (total > 0 || presetLayers) {
          cards.push({ key: grp.label, displayLayer: grp.label, value: total, active });
        }
      } else {
        const value = counts[layer] || 0;
        if (value > 0 || presetLayers) {
          // `key` is the underlying layer identifier (used by toggle handlers);
          // `displayLayer` is the user-facing label shown on the card.
          cards.push({ key: layer, displayLayer: labelFor(layer), value, active: !!activeLayers[layer] });
        }
      }
    });

    return cards;
  }, [activeLayers, pointData, locationData, densityData, presetLayers]);

  if (stats.length === 0) return null;
  const cols = stats.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <>
      <div className={`grid ${cols} gap-1.5`} data-testid="layer-stats">
        {stats.map(({ key, displayLayer, value, active }) => {
          const clickable = typeof onLayerToggle === 'function';
          return (
            <button
              key={key}
              type="button"
              onClick={clickable ? () => onLayerToggle(key) : undefined}
              onContextMenu={clickable ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ layer: key, displayLayer, x: e.clientX, y: e.clientY });
              } : undefined}
              className={`border rounded-lg px-2 py-2 text-center transition-all w-full ${
                active
                  ? 'bg-stone-50 border-stone-200'
                  : 'bg-stone-100/60 border-stone-200/60 opacity-60'
              } ${clickable ? 'cursor-pointer hover:opacity-100 hover:border-stone-300 active:scale-95' : ''}`}
              data-testid={`stat-${displayLayer}`}
              title={clickable ? (active ? 'Click to hide. Right-click for more options.' : 'Click to show this layer. Right-click for more options.') : undefined}
            >
              <div
                className="text-lg font-bold leading-tight tracking-tight"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  color: active ? '#D15E13' : '#A8A29E',
                }}
              >
                {formatStat(value)}
              </div>
              <div className={`text-[9px] mt-0.5 leading-tight font-medium ${active ? 'text-stone-600' : 'text-stone-400'}`}>
                {displayLayer}
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
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100 truncate">{menu.displayLayer || menu.layer}</div>
          <button type="button"
            onClick={() => { onLayerToggle && onLayerToggle(menu.layer); setMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 text-stone-700"
            data-testid="ctx-hide-only"
          >Toggle this layer</button>
          <button type="button"
            onClick={() => { onLayerHideOthers && onLayerHideOthers(menu.layer); setMenu(null); }}
            disabled={typeof onLayerHideOthers !== 'function'}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:hover:bg-transparent"
          >Hide all others</button>
          <button type="button"
            onClick={() => { onLayerResetMarket && onLayerResetMarket(); setMenu(null); }}
            disabled={typeof onLayerResetMarket !== 'function'}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:hover:bg-transparent border-t border-stone-100 mt-1"
          >Reset to market default</button>
        </div>
      )}
    </>
  );
};

export default LayerStats;
