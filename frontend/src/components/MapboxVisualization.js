import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getLayerConfig } from '../config/layerConfig';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Convert miles to meters for Mapbox circle radius
const milesToMeters = (miles) => miles * 1609.34;

// US counties GeoJSON source
const COUNTIES_SOURCE = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

const MapboxVisualization = ({
  cityData,
  countyData,
  wheatData,
  activeLayers,
  radiusSettings,
  hasData
}) => {
  const [viewState, setViewState] = useState({
    longitude: -97,
    latitude: 39,
    zoom: 4,
    pitch: 0,
    bearing: 0
  });
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/light-v11');
  const [countiesGeoJSON, setCountiesGeoJSON] = useState(null);
  const mapRef = useRef(null);

  // Load counties GeoJSON
  useEffect(() => {
    fetch(COUNTIES_SOURCE)
      .then(res => res.json())
      .then(data => setCountiesGeoJSON(data))
      .catch(err => console.error('Error loading counties GeoJSON:', err));
  }, []);

  // Build city markers GeoJSON
  const cityMarkersGeoJSON = useMemo(() => {
    if (!cityData || cityData.length === 0) return null;

    const features = [];

    cityData.forEach((city, idx) => {
      // For each active point layer, check if this city has data
      Object.keys(city.layers).forEach(layerName => {
        if (!activeLayers[layerName]) return;
        const value = city.layers[layerName];
        if (value <= 0) return;

        const config = getLayerConfig(layerName);
        if (config.type !== 'point') return;

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [city.lon, city.lat]
          },
          properties: {
            id: `${city.city}-${city.state}-${layerName}-${idx}`,
            city: city.city,
            state: city.state,
            layer: layerName,
            value: value,
            color: config.markerColor || config.color,
            allLayers: JSON.stringify(city.layers)
          }
        });
      });
    });

    return { type: 'FeatureCollection', features };
  }, [cityData, activeLayers]);

  // Build radius circles GeoJSON
  const radiusGeoJSON = useMemo(() => {
    if (!cityData || cityData.length === 0) return null;

    const features = [];

    cityData.forEach((city, idx) => {
      Object.keys(city.layers).forEach(layerName => {
        if (!activeLayers[layerName]) return;
        const value = city.layers[layerName];
        if (value <= 0) return;

        const config = getLayerConfig(layerName);
        if (!config.radius?.enabled) return;

        // Check if radius is toggled on for this layer
        const radiusSetting = radiusSettings[layerName];
        if (!radiusSetting?.visible) return;

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [city.lon, city.lat]
          },
          properties: {
            id: `radius-${city.city}-${layerName}-${idx}`,
            layer: layerName,
            value: value,
            color: config.color,
            radiusMiles: radiusSetting.miles || config.radius.default
          }
        });
      });
    });

    return { type: 'FeatureCollection', features };
  }, [cityData, activeLayers, radiusSettings]);

  // Build county density data keyed by FIPS
  const countyDensityData = useMemo(() => {
    const fipsData = {};

    [...(countyData || []), ...(wheatData || [])].forEach(county => {
      // We need to match county names to FIPS codes
      // For now, store by state+county key
      const key = `${county.state}|${county.county.toUpperCase()}`;
      if (!fipsData[key]) {
        fipsData[key] = { total: 0, layers: {} };
      }

      Object.keys(county.layers).forEach(layer => {
        if (!activeLayers[layer]) return;
        const config = getLayerConfig(layer);
        if (config.type !== 'density' && config.type !== 'base') return;

        const value = county.layers[layer] || 0;
        if (value > 0) {
          fipsData[key].total += value;
          fipsData[key].layers[layer] = (fipsData[key].layers[layer] || 0) + value;
        }
      });
    });

    return fipsData;
  }, [countyData, wheatData, activeLayers]);

  // Build county choropleth GeoJSON by enriching the base GeoJSON with our data
  const enrichedCountiesGeoJSON = useMemo(() => {
    if (!countiesGeoJSON) return null;

    // Create a name-based lookup from our data
    const nameLookup = {};
    [...(countyData || []), ...(wheatData || [])].forEach(county => {
      const countyName = county.county.toUpperCase();
      const state = county.state;
      const key = `${state}|${countyName}`;

      if (!nameLookup[countyName]) {
        nameLookup[countyName] = {};
      }
      if (!nameLookup[countyName][state]) {
        nameLookup[countyName][state] = { total: 0, layers: {} };
      }

      Object.keys(county.layers).forEach(layer => {
        if (!activeLayers[layer]) return;
        const config = getLayerConfig(layer);
        if (config.type !== 'density' && config.type !== 'base') return;

        const value = county.layers[layer] || 0;
        if (value > 0) {
          nameLookup[countyName][state].total += value;
          nameLookup[countyName][state].layers[layer] =
            (nameLookup[countyName][state].layers[layer] || 0) + value;
        }
      });
    });

    // Find max value for color scaling
    let maxVal = 1;
    Object.values(nameLookup).forEach(stateData => {
      Object.values(stateData).forEach(data => {
        if (data.total > maxVal) maxVal = data.total;
      });
    });

    // Enrich features
    const enrichedFeatures = countiesGeoJSON.features.map(feature => {
      const countyName = (feature.properties.NAME || '').toUpperCase();
      const stateFips = (feature.properties.STATE || '');
      const stateData = nameLookup[countyName];

      let total = 0;
      let dominantColor = '#F5F5F4';
      let layerBreakdown = {};

      if (stateData) {
        // Sum across all states that have this county name
        Object.values(stateData).forEach(data => {
          total += data.total;
          Object.entries(data.layers).forEach(([layer, value]) => {
            layerBreakdown[layer] = (layerBreakdown[layer] || 0) + value;
          });
        });

        // Determine dominant color based on highest-value layer
        let maxLayerVal = 0;
        Object.entries(layerBreakdown).forEach(([layer, value]) => {
          if (value > maxLayerVal) {
            maxLayerVal = value;
            dominantColor = getLayerConfig(layer).color;
          }
        });
      }

      // Calculate intensity (0-1) using sqrt scaling for better small value visibility
      const intensity = total > 0 ? Math.sqrt(total) / Math.sqrt(maxVal) : 0;

      return {
        ...feature,
        properties: {
          ...feature.properties,
          density_total: total,
          density_intensity: intensity,
          density_color: dominantColor,
          density_layers: JSON.stringify(layerBreakdown)
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: enrichedFeatures
    };
  }, [countiesGeoJSON, countyData, wheatData, activeLayers]);

  // Handle map click for popups
  const onMapClick = useCallback((event) => {
    const features = event.features;
    if (features && features.length > 0) {
      const feature = features[0];

      if (feature.layer.id === 'city-markers') {
        setPopupInfo({
          longitude: feature.geometry.coordinates[0],
          latitude: feature.geometry.coordinates[1],
          city: feature.properties.city,
          state: feature.properties.state,
          layer: feature.properties.layer,
          value: feature.properties.value,
          allLayers: JSON.parse(feature.properties.allLayers || '{}')
        });
      } else if (feature.layer.id === 'county-fill') {
        const center = event.lngLat;
        setPopupInfo({
          longitude: center.lng,
          latitude: center.lat,
          county: feature.properties.NAME,
          state: feature.properties.STATE,
          total: feature.properties.density_total,
          layers: JSON.parse(feature.properties.density_layers || '{}')
        });
      }
    }
  }, []);

  const onMouseMove = useCallback((event) => {
    const features = event.features;
    if (features && features.length > 0) {
      setHoveredFeature(features[0]);
    } else {
      setHoveredFeature(null);
    }
  }, []);

  const toggleMapStyle = () => {
    setMapStyle(prev =>
      prev === 'mapbox://styles/mapbox/light-v11'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/light-v11'
    );
  };

  const isSatellite = mapStyle.includes('satellite');

  // Get unique radius layers with their colors for the radius paint
  const radiusLayerColors = useMemo(() => {
    const colors = ['match', ['get', 'layer']];
    Object.entries(activeLayers).forEach(([layer]) => {
      const config = getLayerConfig(layer);
      if (config.radius?.enabled) {
        colors.push(layer, config.color);
      }
    });
    colors.push('#888888'); // default
    return colors.length > 3 ? colors : '#888888';
  }, [activeLayers]);

  // Get unique marker colors
  const markerLayerColors = useMemo(() => {
    const colors = ['match', ['get', 'layer']];
    Object.entries(activeLayers).forEach(([layer]) => {
      const config = getLayerConfig(layer);
      if (config.type === 'point') {
        colors.push(layer, config.markerColor || config.color);
      }
    });
    colors.push('#888888'); // default
    return colors.length > 3 ? colors : '#888888';
  }, [activeLayers]);

  return (
    <div className="relative w-full h-full" data-testid="map-container">
      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
          <div className="text-center p-8">
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
          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            onClick={onMapClick}
            onMouseMove={onMouseMove}
            interactiveLayerIds={['city-markers', 'county-fill']}
            mapStyle={mapStyle}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-left" />

            {/* County choropleth fill */}
            {enrichedCountiesGeoJSON && (
              <Source id="counties" type="geojson" data={enrichedCountiesGeoJSON}>
                <Layer
                  id="county-fill"
                  type="fill"
                  paint={{
                    'fill-color': [
                      'case',
                      ['>', ['get', 'density_total'], 0],
                      ['get', 'density_color'],
                      'rgba(0,0,0,0)'
                    ],
                    'fill-opacity': [
                      'case',
                      ['>', ['get', 'density_total'], 0],
                      ['*', ['get', 'density_intensity'], 0.7],
                      0
                    ]
                  }}
                />
                <Layer
                  id="county-outline"
                  type="line"
                  paint={{
                    'line-color': '#D6D3D1',
                    'line-width': 0.3
                  }}
                />
              </Source>
            )}

            {/* State borders - thick dark lines */}
            <Source
              id="state-borders"
              type="vector"
              url="mapbox://mapbox.boundaries-adm1-v4"
            >
              <Layer
                id="state-lines"
                type="line"
                source-layer="boundaries_admin_1"
                filter={['==', ['get', 'iso_3166_1'], 'US']}
                paint={{
                  'line-color': '#1C1917',
                  'line-width': 1.5
                }}
              />
            </Source>

            {/* Radius circles (semi-transparent) */}
            {radiusGeoJSON && radiusGeoJSON.features.length > 0 && (
              <Source id="radius-circles" type="geojson" data={radiusGeoJSON}>
                <Layer
                  id="radius-fill"
                  type="circle"
                  paint={{
                    'circle-radius': [
                      'interpolate', ['linear'], ['zoom'],
                      3, ['/', ['*', ['get', 'radiusMiles'], 1609.34], 5000],
                      5, ['/', ['*', ['get', 'radiusMiles'], 1609.34], 2000],
                      7, ['/', ['*', ['get', 'radiusMiles'], 1609.34], 500],
                      10, ['/', ['*', ['get', 'radiusMiles'], 1609.34], 100],
                      14, ['/', ['*', ['get', 'radiusMiles'], 1609.34], 10]
                    ],
                    'circle-color': typeof radiusLayerColors === 'string' ? radiusLayerColors : radiusLayerColors,
                    'circle-opacity': 0.15,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': typeof radiusLayerColors === 'string' ? radiusLayerColors : radiusLayerColors,
                    'circle-stroke-opacity': 0.4
                  }}
                />
              </Source>
            )}

            {/* City point markers */}
            {cityMarkersGeoJSON && cityMarkersGeoJSON.features.length > 0 && (
              <Source id="city-markers-source" type="geojson" data={cityMarkersGeoJSON}>
                <Layer
                  id="city-markers"
                  type="circle"
                  paint={{
                    'circle-radius': [
                      'interpolate', ['linear'], ['get', 'value'],
                      0, 4,
                      10, 7,
                      50, 10,
                      200, 14
                    ],
                    'circle-color': typeof markerLayerColors === 'string' ? markerLayerColors : markerLayerColors,
                    'circle-opacity': 0.85,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF'
                  }}
                />
              </Source>
            )}

            {/* Popup */}
            {popupInfo && (
              <Popup
                longitude={popupInfo.longitude}
                latitude={popupInfo.latitude}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
                closeButton={true}
                closeOnClick={false}
                className="territory-popup"
              >
                <div className="p-1 min-w-[160px]">
                  {popupInfo.city && (
                    <>
                      <div className="text-sm font-semibold text-stone-900">
                        {popupInfo.city}, {popupInfo.state}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(popupInfo.allLayers || {}).map(([layer, value]) => (
                          value > 0 && activeLayers[layer] ? (
                            <div key={layer} className="text-xs text-stone-600 flex justify-between gap-3">
                              <span>{layer}:</span>
                              <span className="font-medium">{value.toLocaleString()}</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                    </>
                  )}
                  {popupInfo.county && (
                    <>
                      <div className="text-sm font-semibold text-stone-900">
                        {popupInfo.county} County
                      </div>
                      <div className="text-xs text-stone-500">
                        Total: {(popupInfo.total || 0).toLocaleString()}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(popupInfo.layers || {}).map(([layer, value]) => (
                          <div key={layer} className="text-xs text-stone-600 flex justify-between gap-3">
                            <span>{layer}:</span>
                            <span className="font-medium">{value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Popup>
            )}
          </Map>

          {/* Map style toggle */}
          <button
            onClick={toggleMapStyle}
            className="absolute top-4 left-14 bg-white border border-stone-300 rounded px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 shadow-sm z-10"
            data-testid="map-style-toggle"
          >
            {isSatellite ? 'Street View' : 'Satellite'}
          </button>
        </>
      )}
    </div>
  );
};

export default MapboxVisualization;
