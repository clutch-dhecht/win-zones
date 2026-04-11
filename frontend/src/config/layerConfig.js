// Layer configuration for Territory Atlas
// Edit this file to add/remove layers, change colors, enable/disable radius

export const LAYER_CONFIG = {
  // --- POINT LAYERS (City-level data with lat/lon) ---
  "Feed Mills": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#B45309",
    markerColor: "#B45309",
    order: 1
  },
  "Hog Producers": {
    type: "point",
    radius: { enabled: false, default: 50, options: [25, 50, 100] },
    color: "#9F1239",
    markerColor: "#9F1239",
    order: 2
  },
  "Grain Fumigation": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#15803D",
    markerColor: "#15803D",
    order: 3
  },
  "Customers": {
    type: "point",
    radius: { enabled: true, default: 50, options: [25, 50, 100] },
    color: "#0369A1",
    markerColor: "#0369A1",
    order: 4
  },

  // --- DENSITY LAYERS (County-level aggregations) ---
  "1000-plus Acre Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#F59E0B",
    fillOpacity: 0.6,
    order: 5
  },
  "Growers with On Farm Storage": {
    type: "density",
    radius: { enabled: false },
    color: "#84CC16",
    fillOpacity: 0.6,
    order: 6
  },
  "Grain Retail Handlers": {
    type: "density",
    radius: { enabled: false },
    color: "#14B8A6",
    fillOpacity: 0.6,
    order: 7
  },

  // --- BASE LAYER (Wheat acreage) ---
  "Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#7C3AED",
    fillOpacity: 0.35,
    order: 8
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
