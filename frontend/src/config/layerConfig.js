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

  // --- DENSITY LAYERS (County-level aggregations) ---
  "1000+ Wheat Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#F59E0B",
    fillOpacity: 0.6,
    order: 10
  },
  "1000+ Corn Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#EA580C",
    fillOpacity: 0.6,
    order: 11
  },
  "1000+ Rice Growers": {
    type: "density",
    radius: { enabled: false },
    color: "#0E7490",
    fillOpacity: 0.6,
    order: 12
  },
  "1000+ Hogs": {
    type: "density",
    radius: { enabled: false },
    color: "#9F1239",
    fillOpacity: 0.6,
    order: 13
  },
  "Farms with Grain Storage": {
    type: "density",
    radius: { enabled: false },
    color: "#84CC16",
    fillOpacity: 0.6,
    order: 11
  },

  // --- ACREAGE LAYERS ---
  "Wheat Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#D97706",
    fillOpacity: 0.35,
    order: 12
  },
  "Rice Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#0891B2",
    fillOpacity: 0.35,
    order: 13
  },
  "Corn Acres": {
    type: "base",
    radius: { enabled: false },
    color: "#DC2626",
    fillOpacity: 0.35,
    order: 14
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
