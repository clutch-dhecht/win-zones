// Layer configuration for Territory Atlas
// Edit this file to add/remove layers, change colors, enable/disable radius

export const LAYER_CONFIG = {
  // --- POINT LAYERS (City-level data with lat/lon) ---
  "CLS Customers": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#0369A1",
    markerColor: "#0369A1",
    order: 1
  },

  // --- DENSITY LAYERS (County-level aggregations) ---
  "1000+ Wheat Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#F59E0B",
    fillOpacity: 0.6,
    order: 2
  },
  "Farms with Grain Storage": {
    type: "density",
    radius: { enabled: false },
    color: "#84CC16",
    fillOpacity: 0.6,
    order: 3
  },

  // --- ACREAGE LAYERS ---
  "Wheat Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#7C3AED",
    fillOpacity: 0.35,
    order: 4
  },
  "Rice Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#0891B2",
    fillOpacity: 0.35,
    order: 5
  },
  "Corn Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#DC2626",
    fillOpacity: 0.35,
    order: 6
  }
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
