import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

const LAYER_COLORS = {
  city_0: '#B45309',
  city_1: '#9F1239',
  city_2: '#15803D',
  city_3: '#0369A1',
  county_0: '#F59E0B',
  county_1: '#84CC16',
  county_2: '#14B8A6'
};

const MapVisualization = ({ cityData, countyData, activeLayers, hasData }) => {
  const [tooltip, setTooltip] = useState(null);

  // Process county data for choropleth
  const countyTotals = useMemo(() => {
    const totals = {};
    
    countyData.forEach(county => {
      const key = `${county.state}-${county.county}`;
      let total = 0;
      
      Object.keys(county.layers).forEach((layer, idx) => {
        const layerKey = `county_${layer}`;
        if (activeLayers[layerKey]) {
          total += county.layers[layer];
        }
      });
      
      if (total > 0) {
        totals[key] = total;
      }
    });
    
    return totals;
  }, [countyData, activeLayers]);

  // Get max value for scaling
  const maxCountyValue = useMemo(() => {
    const values = Object.values(countyTotals);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [countyTotals]);

  // Color scale for counties
  const colorScale = useMemo(() => {
    return scaleLinear()
      .domain([0, maxCountyValue])
      .range(['#E7E5E4', '#166534']);
  }, [maxCountyValue]);

  // Process city data for markers
  const cityMarkers = useMemo(() => {
    const markers = [];
    
    cityData.forEach(city => {
      let total = 0;
      let activeLayerCount = 0;
      
      Object.keys(city.layers).forEach((layer, idx) => {
        const layerKey = `city_${layer}`;
        if (activeLayers[layerKey]) {
          total += city.layers[layer];
          activeLayerCount++;
        }
      });
      
      if (total > 0) {
        markers.push({
          city: city.city,
          state: city.state,
          coordinates: [city.lon, city.lat],
          value: total,
          layers: city.layers
        });
      }
    });
    
    return markers;
  }, [cityData, activeLayers]);

  // Get max city value for marker sizing
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
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const stateName = geo.properties.name;
                    const countyName = geo.properties.name;
                    const key = `${stateName}-${countyName}`;
                    const value = countyTotals[key] || 0;
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={value > 0 ? colorScale(value) : '#E7E5E4'}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
                        onMouseEnter={() => {
                          if (value > 0) {
                            setTooltip({
                              name: countyName,
                              value: value
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          default: { outline: 'none' },
                          hover: { fill: value > 0 ? '#14532D' : '#E7E5E4', outline: 'none' },
                          pressed: { outline: 'none' }
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              {/* City Markers */}
              {cityMarkers.map((marker, idx) => (
                <Marker
                  key={`${marker.city}-${idx}`}
                  coordinates={marker.coordinates}
                  onMouseEnter={() => {
                    setTooltip({
                      name: `${marker.city}, ${marker.state}`,
                      value: marker.value,
                      layers: marker.layers
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    r={getMarkerSize(marker.value)}
                    fill="#B45309"
                    fillOpacity={0.7}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                    style={{ mixBlendMode: 'multiply', cursor: 'pointer' }}
                    data-testid={`city-marker-${idx}`}
                  />
                </Marker>
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white border border-stone-200 rounded shadow-lg p-3 z-20"
              style={{ pointerEvents: 'none' }}
              data-testid="map-tooltip"
            >
              <div className="text-sm font-semibold text-stone-900">{tooltip.name}</div>
              <div className="text-xs text-stone-600">Total: {tooltip.value.toLocaleString()}</div>
              {tooltip.layers && (
                <div className="mt-1 text-xs text-stone-500">
                  {Object.entries(tooltip.layers).map(([layer, value]) => (
                    <div key={layer}>{layer}: {value}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-4 right-4 bg-white border border-stone-200 rounded shadow-sm p-3" data-testid="map-legend">
            <div className="text-xs font-semibold text-stone-700 mb-2">Legend</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E7E5E4' }} />
                <span className="text-xs text-stone-600">No data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#166534' }} />
                <span className="text-xs text-stone-600">High activity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#B45309' }} />
                <span className="text-xs text-stone-600">City markers</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapVisualization;
