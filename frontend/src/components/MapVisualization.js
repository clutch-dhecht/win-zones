import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const countiesGeoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';
const statesGeoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const LAYER_COLORS = [
  '#B45309', '#9F1239', '#15803D', '#0369A1',
  '#F59E0B', '#84CC16', '#14B8A6', '#7C3AED',
  '#DB2777', '#059669', '#2563EB', '#DC2626'
];

const MapVisualization = ({ cityData, countyData, wheatData, activeLayers, hasData }) => {
  const [tooltip, setTooltip] = useState(null);

  // Get all unique layer names in order
  const allLayerNames = useMemo(() => {
    const layersSet = new Set();
    [...cityData, ...countyData, ...(wheatData || [])].forEach(item => {
      Object.keys(item.layers).forEach(layer => layersSet.add(layer));
    });
    return Array.from(layersSet);
  }, [cityData, countyData, wheatData]);

  // Create a color scale for each layer
  const layerColorScales = useMemo(() => {
    const scales = {};
    allLayerNames.forEach((layerName, idx) => {
      const color = LAYER_COLORS[idx % LAYER_COLORS.length];
      scales[layerName] = {
        color: color,
        scale: scaleLinear().range(['rgba(0,0,0,0)', color])
      };
    });
    return scales;
  }, [allLayerNames]);

  // Separate Acres as base layer and other layers
  const acresData = useMemo(() => {
    const data = {};
    let maxValue = 0;
    
    [...countyData, ...(wheatData || [])].forEach(county => {
      if (county.layers['Acres'] && activeLayers['Acres']) {
        const countyName = county.county.toUpperCase();
        data[countyName] = county.layers['Acres'];
        maxValue = Math.max(maxValue, data[countyName]);
      }
    });
    
    return { data, maxValue: maxValue || 1 };
  }, [countyData, wheatData, activeLayers]);

  // Base layer color scale for Acres (purple/lavender)
  const acresColorScale = useMemo(() => {
    return scaleLinear()
      .domain([0, acresData.maxValue])
      .range(['rgba(245, 245, 244, 0.3)', 'rgba(124, 58, 237, 0.4)']);
  }, [acresData.maxValue]);

  // Process county data by layer (excluding Acres) for multi-color visualization
  const countyDataByLayer = useMemo(() => {
    const layerData = {};
    const maxValues = {};
    
    // Initialize - exclude Acres
    Object.keys(activeLayers).forEach(layerName => {
      if (activeLayers[layerName] && layerName !== 'Acres') {
        layerData[layerName] = {};
        maxValues[layerName] = 0;
      }
    });
    
    // Aggregate county-level data by layer (excluding Acres)
    [...countyData, ...(wheatData || [])].forEach(county => {
      const countyName = county.county.toUpperCase();
      
      Object.keys(county.layers).forEach((layer) => {
        if (activeLayers[layer] && layer !== 'Acres') {
          if (!layerData[layer][countyName]) {
            layerData[layer][countyName] = 0;
          }
          const value = county.layers[layer];
          layerData[layer][countyName] += value;
          maxValues[layer] = Math.max(maxValues[layer], layerData[layer][countyName]);
        }
      });
    });
    
    // Update scales with max values
    Object.keys(maxValues).forEach(layer => {
      if (layerColorScales[layer]) {
        layerColorScales[layer].scale.domain([0, maxValues[layer] || 1]);
      }
    });
    
    return layerData;
  }, [countyData, wheatData, activeLayers, layerColorScales]);

  // Get blended color for a county based on all active layers
  const getCountyColor = (countyName) => {
    const activeLayers = Object.keys(countyDataByLayer).filter(layer => 
      countyDataByLayer[layer][countyName] > 0
    );
    
    if (activeLayers.length === 0) return '#F5F5F4';
    
    // If only one layer, use its color
    if (activeLayers.length === 1) {
      const layer = activeLayers[0];
      const value = countyDataByLayer[layer][countyName];
      return layerColorScales[layer].scale(value);
    }
    
    // Multiple layers: blend colors
    let r = 0, g = 0, b = 0, totalWeight = 0;
    
    activeLayers.forEach(layer => {
      const value = countyDataByLayer[layer][countyName];
      const color = layerColorScales[layer].color;
      const weight = value;
      
      // Parse hex color
      const hex = color.replace('#', '');
      const rVal = parseInt(hex.substr(0, 2), 16);
      const gVal = parseInt(hex.substr(2, 2), 16);
      const bVal = parseInt(hex.substr(4, 2), 16);
      
      r += rVal * weight;
      g += gVal * weight;
      b += bVal * weight;
      totalWeight += weight;
    });
    
    if (totalWeight > 0) {
      r = Math.round(r / totalWeight);
      g = Math.round(g / totalWeight);
      b = Math.round(b / totalWeight);
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    return '#F5F5F4';
  };

  // Calculate total for tooltip (excluding Acres)
  const getCountyTotal = (countyName) => {
    let total = 0;
    let breakdown = {};
    Object.keys(countyDataByLayer).forEach(layer => {
      const value = countyDataByLayer[layer][countyName] || 0;
      if (value > 0) {
        total += value;
        breakdown[layer] = value;
      }
    });
    return { total, breakdown };
  };

  // Process city data for markers with individual colors per layer
  const cityMarkers = useMemo(() => {
    const markers = [];
    
    cityData.forEach(city => {
      let total = 0;
      let activeCityLayers = [];
      
      Object.keys(city.layers).forEach((layer) => {
        if (activeLayers[layer]) {
          const value = city.layers[layer];
          if (value > 0) {
            total += value;
            activeCityLayers.push({ layer, value });
          }
        }
      });
      
      if (total > 0) {
        // Determine marker color based on dominant layer
        let dominantLayer = activeCityLayers.sort((a, b) => b.value - a.value)[0];
        const layerIndex = allLayerNames.indexOf(dominantLayer.layer);
        const markerColor = LAYER_COLORS[layerIndex % LAYER_COLORS.length];
        
        markers.push({
          city: city.city,
          state: city.state,
          coordinates: [city.lon, city.lat],
          value: total,
          color: markerColor,
          layers: city.layers,
          dominantLayer: dominantLayer.layer
        });
      }
    });
    
    return markers;
  }, [cityData, activeLayers, allLayerNames]);

  const maxCityValue = useMemo(() => {
    const values = cityMarkers.map(m => m.value);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [cityMarkers]);

  const getMarkerSize = (value) => {
    const scale = scaleLinear()
      .domain([0, maxCityValue])
      .range([3, 15]);
    return scale(value);
  };

  return (
    <div className="relative w-full h-full" data-testid="map-container">
      {!hasData ? (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1526452292898-227ed70e55b5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHxhZXJpYWwlMjBmYXJtJTIwbGFuZHNjYXBlJTIwbWluaW1hbHxlbnwwfHx8fDE3NzU3NDU3MTh8MA&ixlib=rb-4.1.0&q=85)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-white/90" />
          <div className="relative text-center z-10 p-8">
            <h2 className="text-2xl font-semibold text-stone-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Upload Data to Begin
            </h2>
            <p className="text-sm text-stone-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Upload your city and county CSV files to visualize opportunities on the map
            </p>
          </div>
        </div>
      ) : (
        <>
          <ComposableMap
            projection="geoAlbersUsa"
            className="w-full h-full"
            data-testid="map-svg"
          >
            <ZoomableGroup zoom={1} center={[-97, 38]}>
              {/* Base layer: Acres (if active) - rendered first, doesn't blend */}
              {activeLayers['Acres'] && (
                <Geographies geography={countiesGeoUrl}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      const countyName = (geo.properties.name || '').toUpperCase();
                      const acresValue = acresData.data[countyName] || 0;
                      
                      return (
                        <Geography
                          key={`acres-${geo.rsmKey}`}
                          geography={geo}
                          fill={acresValue > 0 ? acresColorScale(acresValue) : 'rgba(245, 245, 244, 0.1)'}
                          stroke="none"
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none' },
                            pressed: { outline: 'none' }
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              )}

              {/* Operational layers (excluding Acres) with blending */}
              <Geographies geography={countiesGeoUrl}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const countyName = (geo.properties.name || '').toUpperCase();
                    const countyInfo = getCountyTotal(countyName);
                    const fillColor = getCountyColor(countyName);
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={countyInfo.total > 0 ? fillColor : 'transparent'}
                        stroke="#FFFFFF"
                        strokeWidth={0.3}
                        onMouseEnter={() => {
                          if (countyInfo.total > 0) {
                            setTooltip({
                              name: countyName,
                              value: countyInfo.total,
                              breakdown: countyInfo.breakdown
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          default: { outline: 'none' },
                          hover: { 
                            fill: countyInfo.total > 0 ? '#14532D' : fillColor, 
                            outline: 'none' 
                          },
                          pressed: { outline: 'none' }
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              {/* State borders overlay - thick dark lines */}
              <Geographies geography={statesGeoUrl}>
                {({ geographies }) =>
                  geographies.map(geo => (
                    <Geography
                      key={`state-${geo.rsmKey}`}
                      geography={geo}
                      fill="none"
                      stroke="#1C1917"
                      strokeWidth={1.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none' },
                        pressed: { outline: 'none' }
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* City Markers with per-layer colors */}
              {cityMarkers.map((marker, idx) => (
                <Marker
                  key={`${marker.city}-${idx}`}
                  coordinates={marker.coordinates}
                  onMouseEnter={() => {
                    setTooltip({
                      name: `${marker.city}, ${marker.state}`,
                      value: marker.value,
                      layers: marker.layers,
                      dominantLayer: marker.dominantLayer
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    r={getMarkerSize(marker.value)}
                    fill={marker.color}
                    fillOpacity={0.8}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    style={{ cursor: 'pointer' }}
                    data-testid={`city-marker-${idx}`}
                  />
                </Marker>
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white border border-stone-200 rounded shadow-lg p-3 z-20 max-w-xs"
              style={{ pointerEvents: 'none' }}
              data-testid="map-tooltip"
            >
              <div className="text-sm font-semibold text-stone-900">{tooltip.name}</div>
              {tooltip.dominantLayer && (
                <div className="text-xs text-stone-500 mt-0.5">Primary: {tooltip.dominantLayer}</div>
              )}
              <div className="text-xs text-stone-600 mt-1">Total: {tooltip.value.toLocaleString()}</div>
              {tooltip.breakdown && Object.keys(tooltip.breakdown).length > 0 && (
                <div className="mt-2 space-y-1 border-t border-stone-200 pt-2">
                  {Object.entries(tooltip.breakdown).map(([layer, value]) => (
                    <div key={layer} className="text-xs text-stone-500 flex justify-between gap-2">
                      <span>{layer}:</span>
                      <span className="font-medium">{value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-4 right-4 bg-white border border-stone-200 rounded shadow-sm p-3" data-testid="map-legend">
            <div className="text-xs font-semibold text-stone-700 mb-2">Active Layers</div>
            <div className="space-y-1">
              {activeLayers['Acres'] && (
                <div className="flex items-center gap-2 pb-1 mb-1 border-b border-stone-200">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#7C3AED' }} />
                  <span className="text-xs text-stone-600">Acres (base layer)</span>
                </div>
              )}
              {Object.keys(countyDataByLayer).map((layer, idx) => (
                <div key={layer} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: layerColorScales[layer]?.color || '#166534' }} 
                  />
                  <span className="text-xs text-stone-600">{layer}</span>
                </div>
              ))}
              {cityMarkers.length > 0 && (
                <div className="pt-1 border-t border-stone-200 mt-1">
                  <div className="text-xs text-stone-500 mb-1">City markers:</div>
                  {Array.from(new Set(cityMarkers.map(m => m.dominantLayer))).map(layer => {
                    const layerIndex = allLayerNames.indexOf(layer);
                    const color = LAYER_COLORS[layerIndex % LAYER_COLORS.length];
                    return (
                      <div key={layer} className="flex items-center gap-2 ml-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs text-stone-600">{layer}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapVisualization;
