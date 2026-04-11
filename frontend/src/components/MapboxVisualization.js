import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import circle from '@turf/circle';
import { getLayerConfig } from '../config/layerConfig';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// US counties GeoJSON source (Plotly dataset with FIPS codes)
const COUNTIES_SOURCE = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

// FIPS State Code -> State Name mapping
const FIPS_TO_STATE = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
};

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

  // Build clustered city markers GeoJSON (one feature per city, aggregated)
  const cityMarkersGeoJSON = useMemo(() => {
    if (!cityData || cityData.length === 0) return null;

    const features = [];

    cityData.forEach((city, idx) => {
      // Check if any active point layer has data for this city
      let hasActivePoint = false;
      let dominantLayer = null;
      let maxVal = 0;

      Object.keys(city.layers).forEach(layerName => {
        if (!activeLayers[layerName]) return;
        const config = getLayerConfig(layerName);
        if (config.type !== 'point') return;
        const value = city.layers[layerName];
        if (value > 0) {
          hasActivePoint = true;
          if (value > maxVal) {
            maxVal = value;
            dominantLayer = layerName;
          }
        }
      });

      if (!hasActivePoint || !dominantLayer) return;

      const config = getLayerConfig(dominantLayer);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [city.lon, city.lat]
        },
        properties: {
          id: `city-${idx}`,
          city: city.city,
          state: city.state,
          layer: dominantLayer,
          value: maxVal,
          color: config.markerColor || config.color,
          allLayers: JSON.stringify(city.layers)
        }
      });
    });

    return { type: 'FeatureCollection', features };
  }, [cityData, activeLayers]);

  // Build radius circles as actual geographic polygons using turf
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

        const radiusSetting = radiusSettings[layerName];
        if (!radiusSetting?.visible) return;

        const miles = radiusSetting.miles || config.radius.default;
        // turf circle: center, radius, options (units in miles)
        const circleFeature = circle(
          [city.lon, city.lat],
          miles,
          { steps: 64, units: 'miles' }
        );

        circleFeature.properties = {
          id: `radius-${idx}-${layerName}`,
          layer: layerName,
          city: city.city,
          state: city.state,
          value,
          color: config.color,
          radiusMiles: miles
        };

        features.push(circleFeature);
      });
    });

    return { type: 'FeatureCollection', features };
  }, [cityData, activeLayers, radiusSettings]);

  // Build county choropleth GeoJSON with FIPS-to-State matching
  const enrichedCountiesGeoJSON = useMemo(() => {
    if (!countiesGeoJSON) return null;

    // Normalize state name to Title Case for consistent matching
    const normalizeState = (s) => {
      if (!s) return '';
      return s.trim().split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    };

    // Build lookup: "StateName|COUNTYNAME" -> { total, layers }
    const dataLookup = {};

    [...(countyData || []), ...(wheatData || [])].forEach(county => {
      const key = `${normalizeState(county.state)}|${county.county.toUpperCase()}`;
      if (!dataLookup[key]) {
        dataLookup[key] = { total: 0, layers: {} };
      }

      Object.keys(county.layers).forEach(layer => {
        if (!activeLayers[layer]) return;
        const config = getLayerConfig(layer);
        if (config.type !== 'density' && config.type !== 'base') return;

        const value = county.layers[layer] || 0;
        if (value > 0) {
          dataLookup[key].total += value;
          dataLookup[key].layers[layer] = (dataLookup[key].layers[layer] || 0) + value;
        }
      });
    });

    // Use log scaling — find max for normalization
    let maxVal = 1;
    Object.values(dataLookup).forEach(data => {
      if (data.total > maxVal) maxVal = data.total;
    });
    const logMax = Math.log(maxVal + 1);

    // Enrich GeoJSON features using FIPS -> state name mapping
    const enrichedFeatures = countiesGeoJSON.features.map(feature => {
      const countyName = (feature.properties.NAME || '').toUpperCase();
      const stateFips = feature.properties.STATE || '';
      const stateName = FIPS_TO_STATE[stateFips] || '';
      const key = `${stateName}|${countyName}`;

      const data = dataLookup[key];
      let total = 0;
      let dominantColor = 'rgba(0,0,0,0)';
      let layerBreakdown = {};

      if (data && data.total > 0) {
        total = data.total;
        layerBreakdown = data.layers;

        // Determine color from highest-value layer
        let maxLayerVal = 0;
        Object.entries(layerBreakdown).forEach(([layer, value]) => {
          if (value > maxLayerVal) {
            maxLayerVal = value;
            dominantColor = getLayerConfig(layer).color;
          }
        });
      }

      // Log scaling with minimum visible opacity for any non-zero value
      let intensity = 0;
      if (total > 0) {
        intensity = Math.log(total + 1) / logMax;
        intensity = Math.max(intensity, 0.2); // min visible
        intensity = Math.min(intensity * 0.8, 0.85); // cap
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          density_total: total,
          density_intensity: intensity,
          density_color: dominantColor,
          density_layers: JSON.stringify(layerBreakdown),
          state_name: stateName
        }
      };
    });

    return { type: 'FeatureCollection', features: enrichedFeatures };
  }, [countiesGeoJSON, countyData, wheatData, activeLayers]);

  // Check if any density layer is active
  const hasDensityActive = useMemo(() => {
    return Object.keys(activeLayers).some(layer => {
      if (!activeLayers[layer]) return false;
      const config = getLayerConfig(layer);
      return config.type === 'density' || config.type === 'base';
    });
  }, [activeLayers]);

  // Handle map click for popups
  const onMapClick = useCallback((event) => {
    const features = event.features;
    if (!features || features.length === 0) {
      setPopupInfo(null);
      return;
    }

    const feature = features[0];

    if (feature.layer.id === 'city-markers-unclustered' || feature.layer.id === 'city-markers') {
      setPopupInfo({
        type: 'city',
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        city: feature.properties.city,
        state: feature.properties.state,
        layer: feature.properties.layer,
        value: feature.properties.value,
        allLayers: JSON.parse(feature.properties.allLayers || '{}')
      });
    } else if (feature.layer.id === 'cluster-count') {
      // Zoom into cluster
      const map = mapRef.current?.getMap();
      if (map) {
        map.easeTo({
          center: feature.geometry.coordinates,
          zoom: viewState.zoom + 2
        });
      }
    } else if (feature.layer.id === 'county-fill' && feature.properties.density_total > 0) {
      setPopupInfo({
        type: 'county',
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        county: feature.properties.NAME,
        state: feature.properties.state_name,
        total: feature.properties.density_total,
        layers: JSON.parse(feature.properties.density_layers || '{}')
      });
    }
  }, [viewState.zoom]);

  const toggleMapStyle = () => {
    setMapStyle(prev =>
      prev === 'mapbox://styles/mapbox/light-v11'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/light-v11'
    );
  };

  const isSatellite = mapStyle.includes('satellite');

  // Build color expressions for per-layer radius fills
  const radiusColorExpr = useMemo(() => {
    const entries = [];
    Object.keys(activeLayers).forEach(layer => {
      if (!activeLayers[layer]) return;
      const config = getLayerConfig(layer);
      if (config.radius?.enabled) {
        entries.push(layer, config.color);
      }
    });
    if (entries.length === 0) return '#888888';
    return ['match', ['get', 'layer'], ...entries, '#888888'];
  }, [activeLayers]);

  // Build marker color expression
  const markerColorExpr = useMemo(() => {
    const entries = [];
    Object.keys(activeLayers).forEach(layer => {
      if (!activeLayers[layer]) return;
      const config = getLayerConfig(layer);
      if (config.type === 'point') {
        entries.push(layer, config.markerColor || config.color);
      }
    });
    if (entries.length === 0) return '#888888';
    return ['match', ['get', 'layer'], ...entries, '#888888'];
  }, [activeLayers]);

  const interactiveIds = useMemo(() => {
    const ids = ['city-markers-unclustered'];
    if (hasDensityActive) ids.push('county-fill');
    return ids;
  }, [hasDensityActive]);

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
            interactiveLayerIds={interactiveIds}
            mapStyle={mapStyle}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-left" />

            {/* County choropleth fill */}
            {hasDensityActive && enrichedCountiesGeoJSON && (
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
                      ['get', 'density_intensity'],
                      0
                    ]
                  }}
                />
                <Layer
                  id="county-outline"
                  type="line"
                  paint={{
                    'line-color': '#A8A29E',
                    'line-width': 0.3
                  }}
                />
              </Source>
            )}

            {/* Radius circles - rendered as filled geographic polygons */}
            {radiusGeoJSON && radiusGeoJSON.features.length > 0 && (
              <Source id="radius-circles" type="geojson" data={radiusGeoJSON}>
                <Layer
                  id="radius-fill"
                  type="fill"
                  paint={{
                    'fill-color': typeof radiusColorExpr === 'string' ? radiusColorExpr : radiusColorExpr,
                    'fill-opacity': 0.12
                  }}
                />
                <Layer
                  id="radius-outline"
                  type="line"
                  paint={{
                    'line-color': typeof radiusColorExpr === 'string' ? radiusColorExpr : radiusColorExpr,
                    'line-width': 1.5,
                    'line-opacity': 0.5
                  }}
                />
              </Source>
            )}

            {/* City point markers with clustering */}
            {cityMarkersGeoJSON && cityMarkersGeoJSON.features.length > 0 && (
              <Source
                id="city-markers-source"
                type="geojson"
                data={cityMarkersGeoJSON}
                cluster={true}
                clusterMaxZoom={12}
                clusterRadius={50}
              >
                {/* Cluster circles */}
                <Layer
                  id="clusters"
                  type="circle"
                  filter={['has', 'point_count']}
                  paint={{
                    'circle-color': [
                      'step', ['get', 'point_count'],
                      '#57534E', 10,
                      '#44403C', 50,
                      '#292524', 200,
                      '#1C1917'
                    ],
                    'circle-radius': [
                      'step', ['get', 'point_count'],
                      16, 10,
                      22, 50,
                      28, 200,
                      34
                    ],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF'
                  }}
                />

                {/* Cluster count text */}
                <Layer
                  id="cluster-count"
                  type="symbol"
                  filter={['has', 'point_count']}
                  layout={{
                    'text-field': '{point_count_abbreviated}',
                    'text-size': 12,
                    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
                  }}
                  paint={{
                    'text-color': '#FFFFFF'
                  }}
                />

                {/* Unclustered individual markers */}
                <Layer
                  id="city-markers-unclustered"
                  type="circle"
                  filter={['!', ['has', 'point_count']]}
                  paint={{
                    'circle-radius': [
                      'interpolate', ['linear'], ['get', 'value'],
                      0, 5,
                      10, 7,
                      50, 10,
                      200, 14
                    ],
                    'circle-color': typeof markerColorExpr === 'string' ? markerColorExpr : markerColorExpr,
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
                <div className="p-1 min-w-[160px]" data-testid="map-popup">
                  {popupInfo.type === 'city' && (
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
                  {popupInfo.type === 'county' && (
                    <>
                      <div className="text-sm font-semibold text-stone-900">
                        {popupInfo.county} County, {popupInfo.state}
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
