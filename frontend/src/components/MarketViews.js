import React from 'react';
import { Wheat, Leaf, Bug } from 'lucide-react';

// Simple pig SVG icon
const PigIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="10" cy="12" r="7" />
    <circle cx="5" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <ellipse cx="10" cy="14" rx="2.5" ry="1.5" />
    <circle cx="9" cy="13.5" r="0.4" fill="currentColor" stroke="none" />
    <circle cx="11" cy="13.5" r="0.4" fill="currentColor" stroke="none" />
    <path d="M17 10 C19 8, 21 9, 20 11" />
    <path d="M17 14 C19 16, 21 15, 20 13" />
    <circle cx="7.5" cy="10.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

const NUTRIEN_SUBLAYERS = ['Nutrien Retail', 'Nutrien Terminal', 'Nutrien Storage', 'Nutrien Office'];

// Order here determines the tile grid (row-major, 3 columns).
// Wheat ABM is row 0 col 0 and acts as the default preset on app load.
const MARKET_PRESETS = {
  wheat_abm: {
    label: 'Wheat ABM',
    icon: 'grain',
    layers: [
      'Aurora Coop', ...NUTRIEN_SUBLAYERS, 'Wilbur-Ellis', 'Helena Agri', 'Skyland Grain',
      'CHS Grain', 'McGregor Locations', 'MKC Grain',
      'CLS Customer Locations',
      '1000+ Wheat Growers', 'Wheat Acres',
    ],
    gateByDensityLayers: ['1000+ Wheat Growers', 'Wheat Acres'],
    gateMode: 'any',
    // Auto-spotlight all reps except Darren — wheat-belt territory only
    enableTerritories: true,
    defaultReps: ['laramie', 'sid', 'miya', 'matthew', 'tyler', 'natalie'],
    defaultRepIds: ['laramie', 'sid', 'miya', 'matthew', 'tyler', 'natalie'],
  },
  rice_abm: {
    label: 'Rice ABM',
    icon: 'grain',
    layers: [
      'Riceland Co-op', 'Supreme Rice', 'Producers Rice Mill',
      'Poinsett Rice & Grain', 'Farmers Rice', 'Triton Fumigation',
      '1000+ Rice Growers', 'Rice Acres',
    ],
    gateByDensityLayers: ['1000+ Rice Growers', 'Rice Acres'],
    gateMode: 'any',
    enableTerritories: true,
    defaultReps: ['darren'],
    // Auto-spotlight Darren's territory (AR, LA, MS, TN, KY)
    defaultRepIds: ['darren'],
  },
  wheat: {
    label: 'Wheat',
    icon: 'grain',
    layers: [
      'FSS Grain', 'FSS Flour Mills', 'FSS Specialty Mills', 'FSS Mix Plants',
      'Terminals SRW Wheat', 'Terminals HRW Wheat', 'Terminals HRS Wheat',
      'CHS Grain', 'MKC Grain', 'McGregor Locations', 'Grain Elevators',
      'CLS Customer Locations', 'Grain Fumigation',
      'Aurora Coop', ...NUTRIEN_SUBLAYERS, 'Wilbur-Ellis', 'Helena Agri', 'Skyland Grain',
      '1000+ Wheat Growers', 'Wheat Acres',
    ],
  },
  rice: {
    label: 'Rice',
    icon: 'grain',
    layers: [
      'FSS Grain', 'FSS Flour Mills', 'FSS Specialty Mills', 'FSS Mix Plants',
      'Terminals Rough Rice',
      'Riceland Co-op', 'Supreme Rice', 'Producers Rice Mill',
      'Poinsett Rice & Grain', 'Farmers Rice', 'Triton Fumigation',
      'Grain Elevators', 'CLS Customer Locations', 'Grain Fumigation',
      '1000+ Rice Growers', 'Rice Acres',
    ],
    enableTerritories: true,
    defaultReps: ['darren'],
  },
  wheat_molson_coors: {
    label: 'Molson Coors',
    icon: 'grain',
    layers: [
      'Molson Coors',
      'CLS Customer Locations',
      '1000+ Wheat Growers', 'Wheat Acres',
    ],
  },
  corn: {
    label: 'Corn',
    icon: 'corn',
    layers: [
      'FSS Grain', 'FSS Specialty Mills', 'FSS Mix Plants',
      'Terminals Corn & Soybean',
      'CHS Grain', 'MKC Grain', 'McGregor Locations', 'Grain Elevators',
      'CLS Customer Locations', 'Grain Fumigation',
      '1000+ Corn Growers', 'Corn Acres',
    ],
  },
  hogs: {
    label: 'Hogs',
    icon: 'hog',
    layers: [
      'Terminals Corn & Soybean', 'Terminals Soybean Oil', 'Terminals Soybean Meal',
      'CLS Customer Locations', 'Feed Manufacturers',
      'Corn Acres', '1000+ Hogs',
    ],
  },
  pest: {
    label: 'Alternative',
    icon: 'pest',
    layers: [
      'CLS Customer Locations', 'Grain Fumigation', 'Pest Control',
      '1000+ Wheat Growers', '1000+ Corn Growers', '1000+ Rice Growers',
      'Farms with Grain Storage',
    ],
  },
};

// First market = default selection on app load
export const DEFAULT_MARKET_KEY = 'wheat_abm';

export const MARKET_KEYS = Object.keys(MARKET_PRESETS);
export const getMarketPreset = (key) => MARKET_PRESETS[key];

// Given activeLayers, determine which market (if any) is selected
export const detectActiveMarket = (activeLayers) => {
  for (const [key, preset] of Object.entries(MARKET_PRESETS)) {
    const presetLayers = preset.layers;
    const activeNames = Object.keys(activeLayers).filter(l => activeLayers[l]);
    // Exact match: all preset layers are on, and no others
    if (
      presetLayers.length === activeNames.length &&
      presetLayers.every(l => activeLayers[l]) &&
      activeNames.every(l => presetLayers.includes(l))
    ) {
      return key;
    }
  }
  // Check if anything is on but doesn't match a preset
  const anyOn = Object.values(activeLayers).some(v => v);
  return anyOn ? 'custom' : null;
};

const MarketIcon = ({ type, className }) => {
  if (type === 'grain') return <Wheat className={className} />;
  if (type === 'corn') return <Leaf className={className} />;
  if (type === 'pest') return <Bug className={className} />;
  if (type === 'hog') return <PigIcon className={className} />;
  return null;
};

const MarketViews = ({ activeLayers, allLayers, onMarketSelect, activeMarket }) => {
  const handleSelect = (key) => {
    if (activeMarket === key) {
      // Deselect — turn all off
      onMarketSelect(null);
    } else {
      onMarketSelect(key);
    }
  };

  return (
    <div data-testid="market-views">
      <div className="grid grid-cols-3 gap-1.5">
        {MARKET_KEYS.map(key => {
          const preset = MARKET_PRESETS[key];
          const isActive = activeMarket === key;
          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-lg border text-xs font-medium transition-all ${
                isActive
                  ? 'bg-stone-800 text-white border-stone-800 shadow-sm'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:bg-stone-50'
              }`}
              data-testid={`market-${key}`}
            >
              <MarketIcon type={preset.icon} className={`w-4 h-4 mb-1 ${isActive ? 'text-white' : 'text-stone-400'}`} />
              {preset.label}
            </button>
          );
        })}
        {/* Custom indicator */}
        {activeMarket === 'custom' && (
          <div className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-lg border border-dashed border-stone-300 text-xs text-stone-400">
            <span className="text-[10px]">Custom</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketViews;
