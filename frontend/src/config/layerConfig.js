// Layer configuration for Territory Atlas
// Edit this file to add/remove layers, change colors, enable/disable radius

export const LAYER_CONFIG = {
  // --- POINT LAYERS (City-level data with lat/lon) ---
  "CLS Customer Head Sheds": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#0369A1",
    markerColor: "#0369A1",
    order: 1
  },
  "Grain Elevators": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#B45309",
    markerColor: "#B45309",
    order: 2
  },
  "Feed Manufacturers": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#9F1239",
    markerColor: "#9F1239",
    order: 3
  },
  "Feed Stores": {
    type: "point",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#15803D",
    markerColor: "#15803D",
    order: 4
  },
  "Pest Control": {
    type: "point",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#7C3AED",
    markerColor: "#7C3AED",
    order: 5
  },

  // --- GRAIN FUMIGATION ---
  "Grain Fumigation": {
    type: "point",
    group: "fumigation",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#DC2626",
    markerColor: "#DC2626",
    order: 6
  },

  // --- FSS MILLING (sub-layers by category) ---
  "FSS Grain": {
    type: "point",
    group: "fss_milling",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#D97706",
    markerColor: "#D97706",
    order: 10
  },
  "FSS Flour Mills": {
    type: "point",
    group: "fss_milling",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#CA8A04",
    markerColor: "#CA8A04",
    order: 11
  },
  "FSS Specialty Mills": {
    type: "point",
    group: "fss_milling",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#A16207",
    markerColor: "#A16207",
    order: 12
  },
  "FSS Mix Plants": {
    type: "point",
    group: "fss_milling",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#854D0E",
    markerColor: "#854D0E",
    order: 13
  },

  // --- GRAIN TERMINALS (sub-layers by commodity) ---
  "Terminals SRW Wheat": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#EA580C",
    markerColor: "#EA580C",
    order: 20
  },
  "Terminals HRW Wheat": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#C2410C",
    markerColor: "#C2410C",
    order: 21
  },
  "Terminals HRS Wheat": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#9A3412",
    markerColor: "#9A3412",
    order: 22
  },
  "Terminals Corn & Soybean": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#16A34A",
    markerColor: "#16A34A",
    order: 23
  },
  "Terminals Rough Rice": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#0891B2",
    markerColor: "#0891B2",
    order: 24
  },
  "Terminals Oats": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#65A30D",
    markerColor: "#65A30D",
    order: 25
  },
  "Terminals Soybean Oil": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#0D9488",
    markerColor: "#0D9488",
    order: 26
  },
  "Terminals Soybean Meal": {
    type: "point",
    group: "terminals",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#059669",
    markerColor: "#059669",
    order: 27
  },

  // --- CHS LOCATIONS (sub-layers by Grain / Agronomy) ---
  "CHS Grain": {
    type: "point",
    group: "chs",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#2563EB",
    markerColor: "#2563EB",
    order: 30
  },
  "CHS Agronomy": {
    type: "point",
    group: "chs",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#7C3AED",
    markerColor: "#7C3AED",
    order: 31
  },

  // --- MKC LOCATIONS (sub-layers by Grain / Agronomy) ---
  "MKC Grain": {
    type: "point",
    group: "mkc",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#0284C7",
    markerColor: "#0284C7",
    order: 32
  },
  "MKC Agronomy": {
    type: "point",
    group: "mkc",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#6366F1",
    markerColor: "#6366F1",
    order: 33
  },

  // --- DENSITY LAYERS (County-level aggregations) ---
  "1000+ Wheat Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#F59E0B",
    fillOpacity: 0.6,
    order: 50
  },
  "1000+ Corn Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#EA580C",
    fillOpacity: 0.6,
    order: 51
  },
  "1000+ Rice Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#0E7490",
    fillOpacity: 0.6,
    order: 52
  },
  "1000+ Hogs": {
    type: "density",
    radius: { enabled: false },
    color: "#9F1239",
    fillOpacity: 0.6,
    order: 53
  },
  "Farms with Grain Storage": {
    type: "density",
    radius: { enabled: false },
    color: "#84CC16",
    fillOpacity: 0.6,
    order: 54
  },

  // --- ACREAGE LAYERS ---
  "Wheat Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#D97706",
    fillOpacity: 0.35,
    order: 60
  },
  "Rice Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#0891B2",
    fillOpacity: 0.35,
    order: 61
  },
  "Corn Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#DC2626",
    fillOpacity: 0.35,
    order: 62
  }
};

// Layer groups for sub-filter UI
export const LAYER_GROUPS = {
  fumigation: {
    label: 'Grain Fumigation',
    layers: ['Grain Fumigation'],
  },
  fss_milling: {
    label: 'FSS Milling',
    layers: ['FSS Grain', 'FSS Flour Mills', 'FSS Specialty Mills', 'FSS Mix Plants'],
  },
  terminals: {
    label: 'Grain Terminals',
    layers: ['Terminals SRW Wheat', 'Terminals HRW Wheat', 'Terminals HRS Wheat', 'Terminals Corn & Soybean', 'Terminals Rough Rice', 'Terminals Oats', 'Terminals Soybean Oil', 'Terminals Soybean Meal'],
  },
  chs: {
    label: 'CHS Locations',
    layers: ['CHS Grain', 'CHS Agronomy'],
  },
  mkc: {
    label: 'MKC Locations',
    layers: ['MKC Grain', 'MKC Agronomy'],
  },
};

export const getLayerConfig = (layerName) => {
  return LAYER_CONFIG[layerName] || {
    type: "density",
    radius: { enabled: false },
    color: "#6B7280",
    fillOpacity: 0.5,
    order: 99
  };
};

export const getPointLayers = () => {
  return Object.entries(LAYER_CONFIG)
    .filter(([, config]) => config.type === "point")
    .map(([name]) => name);
};

export const getDensityLayers = () => {
  return Object.entries(LAYER_CONFIG)
    .filter(([, config]) => config.type === "density" || config.type === "base")
    .map(([name]) => name);
};

export const getRadiusLayers = () => {
  return Object.entries(LAYER_CONFIG)
    .filter(([, config]) => config.radius?.enabled)
    .map(([name]) => name);
};

// Get layers that belong to a specific group
export const getGroupLayers = (groupKey) => {
  return LAYER_GROUPS[groupKey]?.layers || [];
};

// Get the group a layer belongs to (if any)
export const getLayerGroup = (layerName) => {
  const config = LAYER_CONFIG[layerName];
  return config?.group || null;
};

// Get all grouped layer names
export const getGroupedLayerNames = () => {
  const grouped = new Set();
  Object.values(LAYER_GROUPS).forEach(g => g.layers.forEach(l => grouped.add(l)));
  return grouped;
};
