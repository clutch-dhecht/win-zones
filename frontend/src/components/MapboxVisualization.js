import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import circle from '@turf/circle';
import { getLayerConfig } from '../config/layerConfig';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const COUNTIES_SOURCE = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

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

const normalizeCountyName = (name) => {
  let n = name.toUpperCase().trim();
  n = n.replace(/ CITY$/, '');
  n = n.replace(/^SAINT /i, 'ST ').replace(/^SAINTE /i, 'STE ');
  n = n.replace(/^ST\. /i, 'ST ').replace(/^STE\. /i, 'STE ');
  n = n.replace(/\./g, '').replace(/'/g, '').replace(/\u00D1/g, 'N').replace(/\u00F1/g, 'N');
  n = n.replace(/^DE /, 'DE').replace(/^LA /, 'LA').replace(/^LE /, 'LE');
  n = n.replace(/-/g, ' ');
  return n;
};

const normalizeStateName = (s) => {
  if (!s) return '';
  return s.trim().split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
};

// Slugify layer name for use as GeoJSON property key
const slugify = (name) => name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

const getColor = (layerName, layerColors) => {
  if (layerColors[layerName]) return layerColors[layerName];
  const config = getLayerConfig(layerName);
  return config.markerColor || config.color;
};

const getDensityColor = (layerName, layerColors) => {
  if (layerColors[layerName]) return layerColors[layerName];
  return getLayerConfig(layerName).color;
};

const MapboxVisualization = ({
  cityData,
  countyData,
  wheatData,
  activeLayers,
  radiusSettings,
  layerColors = {},
  hasData
}) => {
  const [viewState, setViewState] = useState({
    longitude: -97, latitude: 39, zoom: 4, pitch: 0, bearing: 0
  });
  const [popupInfo, setPopupInfo] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/light-v11');
  const [countiesGeoJSON, setCountiesGeoJSON] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    fetch(COUNTIES_SOURCE)
      .then(res => res.json())
      .then(data => setCountiesGeoJSON(data))
      .catch(err => console.error('Error loading counties GeoJSON:', err));
  }, []);

  // Which density layers are currently active
  const activeDensityLayers = useMemo(() => {
    return Object.keys(activeLayers).filter(layer => {
      if (!activeLayers[layer]) return false;
      const config = getLayerConfig(layer);
      return config.type === 'density' || config.type === 'base';
    });
  }, [activeLayers]);

  const hasDensityActive = activeDensityLayers.length > 0;

  // Build city markers GeoJSON
  const cityMarkersGeoJSON = useMemo(() => {
    if (!cityData || cityData.length === 0) return null;
    const features = [];
    cityData.forEach((city, idx) => {
      let dominantLayer = null;
      let maxVal = 0;
      Object.keys(city.layers).forEach(layerName => {
        if (!activeLayers[layerName]) return;
        if (getLayerConfig(layerName).type !== 'point') return;
        const value = city.layers[layerName];
        if (value > 0 && value > maxVal) { maxVal = value; dominantLayer = layerName; }
      });
      if (!dominantLayer) return;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
        properties: {
          id: `city-${idx}`,
          city: city.city,
          state: city.state,
          layer: dominantLayer,
          value: maxVal,
          color: getColor(dominantLayer, layerColors),
          allLayers: JSON.stringify(city.layers)
        }
      });
    });
    return { type: 'FeatureCollection', features };
  }, [cityData, activeLayers, layerColors]);

  // Build radius circles
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
        const rs = radiusSettings[layerName];
        if (!rs?.visible) return;
        const miles = rs.miles || config.radius.default;
        const cf = circle([city.lon, city.lat], miles, { steps: 64, units: 'miles' });
        cf.properties = { id: `r-${idx}-${layerName}`, layer: layerName, color: getDensityColor(layerName, layerColors), radiusMiles: miles };
        features.push(cf);
      });
    });
    return { type: 'FeatureCollection', features };
  }, [cityData, activeLayers, radiusSettings, layerColors]);

  // Build per-layer enriched county GeoJSON
  // Each feature gets properties: `val_{slug}` (raw value) and `int_{slug}` (normalized intensity)
  // for EACH density layer. This allows separate Mapbox fill layers per density layer.
  const enrichedCountiesGeoJSON = useMemo(() => {
    if (!countiesGeoJSON) return null;

    // First pass: build lookup keyed by normalized state|county
    // Structure: { key: { layerName: value, ... } }
    const dataLookup = {};

    [...(countyData || []), ...(wheatData || [])].forEach(county => {
      const state = normalizeStateName(county.state);
      const countyNorm = normalizeCountyName(county.county);
      const key = `${state}|${countyNorm}`;
      if (!dataLookup[key]) dataLookup[key] = {};

      Object.keys(county.layers).forEach(layer => {
        const config = getLayerConfig(layer);
        if (config.type !== 'density' && config.type !== 'base') return;
        const value = county.layers[layer] || 0;
        if (value > 0) {
          dataLookup[key][layer] = (dataLookup[key][layer] || 0) + value;
        }
      });
    });

    // Compute per-layer max for independent normalization
    const layerMaxes = {};
    Object.values(dataLookup).forEach(layers => {
      Object.entries(layers).forEach(([layer, value]) => {
        if (!layerMaxes[layer] || value > layerMaxes[layer]) layerMaxes[layer] = value;
      });
    });

    // Enrich features with per-layer properties
    const enrichedFeatures = countiesGeoJSON.features.map(feature => {
      const rawName = feature.properties.NAME || '';
      const countyNorm = normalizeCountyName(rawName);
      const stateFips = feature.properties.STATE || '';
      const stateName = FIPS_TO_STATE[stateFips] || '';
      const key = `${stateName}|${countyNorm}`;

      const countyLayers = dataLookup[key] || {};
      const extraProps = { state_name: stateName };

      // Per-layer values and intensities
      let totalAllLayers = 0;
      const layerBreakdown = {};

      Object.entries(countyLayers).forEach(([layer, value]) => {
        const slug = slugify(layer);
        const max = layerMaxes[layer] || 1;
        const logMax = Math.log(max + 1);
        let intensity = Math.log(value + 1) / logMax;
        intensity = Math.max(intensity, 0.2);
        intensity = Math.min(intensity * 0.75, 0.8);

        extraProps[`val_${slug}`] = value;
        extraProps[`int_${slug}`] = intensity;
        totalAllLayers += value;
        layerBreakdown[layer] = value;
      });

      extraProps.density_total = totalAllLayers;
      extraProps.density_layers = JSON.stringify(layerBreakdown);

      return {
        ...feature,
        properties: { ...feature.properties, ...extraProps }
      };
    });

    return { type: 'FeatureCollection', features: enrichedFeatures };
  }, [countiesGeoJSON, countyData, wheatData]);

  // Click handler
  const onMapClick = useCallback((event) => {
    const features = event.features;
    if (!features || features.length === 0) { setPopupInfo(null); return; }

    const feature = features[0];
    if (feature.layer.id === 'city-markers-unclustered') {
      setPopupInfo({
        type: 'city',
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        city: feature.properties.city,
        state: feature.properties.state,
        allLayers: JSON.parse(feature.properties.allLayers || '{}')
      });
    } else if (feature.layer.id === 'clusters') {
      const map = mapRef.current?.getMap();
      if (map) map.easeTo({ center: feature.geometry.coordinates, zoom: viewState.zoom + 2 });
    } else if (feature.layer.id.startsWith('county-fill-') && feature.properties.density_total > 0) {
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

  // Hover handler
  const onMouseMove = useCallback((event) => {
    const features = event.features;
    if (!features || features.length === 0) { setHoverInfo(null); return; }

    const feature = features[0];
    if (feature.layer.id === 'city-markers-unclustered') {
      setHoverInfo({
        type: 'city', x: event.point.x, y: event.point.y,
        city: feature.properties.city, state: feature.properties.state,
        layer: feature.properties.layer, value: feature.properties.value
      });
    } else if (feature.layer.id.startsWith('county-fill-') && feature.properties.density_total > 0) {
      // Show per-layer breakdown in hover
      const layers = JSON.parse(feature.properties.density_layers || '{}');
      const activeParts = Object.entries(layers)
        .filter(([l]) => activeLayers[l])
        .map(([l, v]) => `${l}: ${v.toLocaleString()}`)
        .join(' | ');
      setHoverInfo({
        type: 'county', x: event.point.x, y: event.point.y,
        county: feature.properties.NAME, state: feature.properties.state_name,
        total: feature.properties.density_total,
        detail: activeParts
      });
    } else {
      setHoverInfo(null);
    }
  }, [activeLayers]);

  const onMouseLeave = useCallback(() => setHoverInfo(null), []);

  const toggleMapStyle = () => {
    setMapStyle(prev =>
      prev === 'mapbox://styles/mapbox/light-v11'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/light-v11'
    );
  };
  const isSatellite = mapStyle.includes('satellite');

  // Radius color expression
  const radiusColorExpr = useMemo(() => {
    const entries = [];
    Object.keys(activeLayers).forEach(layer => {
      if (!activeLayers[layer]) return;
      if (getLayerConfig(layer).radius?.enabled) entries.push(layer, getDensityColor(layer, layerColors));
    });
    return entries.length === 0 ? '#888888' : ['match', ['get', 'layer'], ...entries, '#888888'];
  }, [activeLayers, layerColors]);

  // Marker color expression
  const markerColorExpr = useMemo(() => {
    const entries = [];
    Object.keys(activeLayers).forEach(layer => {
      if (!activeLayers[layer]) return;
      if (getLayerConfig(layer).type === 'point') entries.push(layer, getColor(layer, layerColors));
    });
    return entries.length === 0 ? '#888888' : ['match', ['get', 'layer'], ...entries, '#888888'];
  }, [activeLayers, layerColors]);

  // Interactive layer IDs (includes per-density-layer fill IDs)
  const interactiveIds = useMemo(() => {
    const ids = ['city-markers-unclustered', 'clusters'];
    activeDensityLayers.forEach(layer => {
      ids.push(`county-fill-${slugify(layer)}`);
    });
    return ids;
  }, [activeDensityLayers]);

  const cursor = hoverInfo ? 'pointer' : 'grab';

  return (
    <div className="relative w-full h-full" data-testid="map-container">
      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
          <div className="text-center p-8">
            <h2 className="text-2xl font-semibold text-stone-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Upload Data to Begin
            </h2>
            <p className="text-sm text-stone-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Upload your CSV files to visualize opportunities on the map
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
            onMouseLeave={onMouseLeave}
            interactiveLayerIds={interactiveIds}
            mapStyle={mapStyle}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            cursor={cursor}
          >
            <NavigationControl position="top-left" />

            {/* County choropleth — one fill layer PER active density layer */}
            {hasDensityActive && enrichedCountiesGeoJSON && (
              <Source id="counties" type="geojson" data={enrichedCountiesGeoJSON}>
                {activeDensityLayers.map(layer => {
                  const slug = slugify(layer);
                  const color = getDensityColor(layer, layerColors);
                  const valProp = `val_${slug}`;
                  const intProp = `int_${slug}`;

                  return (
                    <Layer
                      key={`county-fill-${slug}`}
                      id={`county-fill-${slug}`}
                      type="fill"
                      paint={{
                        'fill-color': color,
                        'fill-opacity': [
                          'case',
                          ['>', ['coalesce', ['get', intProp], 0], 0],
                          ['get', intProp],
                          0
                        ]
                      }}
                    />
                  );
                })}
                <Layer
                  id="county-outline"
                  type="line"
                  paint={{ 'line-color': '#A8A29E', 'line-width': 0.3 }}
                />
              </Source>
            )}

            {/* State / Province borders — bold dark lines */}
            <Source
              id="state-borders"
              type="geojson"
              data="https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
            >
              <Layer
                id="state-lines"
                type="line"
                paint={{
                  'line-color': '#1C1917',
                  'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.4, 6, 2.2, 10, 3],
                  'line-opacity': 0.7
                }}
              />
            </Source>
            <Source
              id="canada-borders"
              type="geojson"
              data="https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson"
            >
              <Layer
                id="canada-lines"
                type="line"
                paint={{
                  'line-color': '#1C1917',
                  'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.4, 6, 2.2, 10, 3],
                  'line-opacity': 0.7
                }}
              />
            </Source>

            {/* Radius circles */}
            {radiusGeoJSON && radiusGeoJSON.features.length > 0 && (
              <Source id="radius-circles" type="geojson" data={radiusGeoJSON}>
                <Layer
                  id="radius-fill"
                  type="fill"
                  paint={{ 'fill-color': radiusColorExpr, 'fill-opacity': 0.12 }}
                />
                <Layer
                  id="radius-outline"
                  type="line"
                  paint={{ 'line-color': radiusColorExpr, 'line-width': 1.5, 'line-opacity': 0.5 }}
                />
              </Source>
            )}

            {/* City markers with clustering */}
            {cityMarkersGeoJSON && cityMarkersGeoJSON.features.length > 0 && (
              <Source
                id="city-markers-source"
                type="geojson"
                data={cityMarkersGeoJSON}
                cluster={true}
                clusterMaxZoom={12}
                clusterRadius={50}
              >
                <Layer
                  id="clusters"
                  type="circle"
                  filter={['has', 'point_count']}
                  paint={{
                    'circle-color': ['step', ['get', 'point_count'], '#57534E', 10, '#44403C', 50, '#292524', 200, '#1C1917'],
                    'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28, 200, 34],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF'
                  }}
                />
                <Layer
                  id="cluster-count"
                  type="symbol"
                  filter={['has', 'point_count']}
                  layout={{
                    'text-field': '{point_count_abbreviated}',
                    'text-size': 12,
                    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
                  }}
                  paint={{ 'text-color': '#FFFFFF' }}
                />
                <Layer
                  id="city-markers-unclustered"
                  type="circle"
                  filter={['!', ['has', 'point_count']]}
                  paint={{
                    'circle-radius': ['interpolate', ['linear'], ['get', 'value'], 0, 5, 10, 7, 50, 10, 200, 14],
                    'circle-color': markerColorExpr,
                    'circle-opacity': 0.85,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF'
                  }}
                />
              </Source>
            )}

            {/* Click popup */}
            {popupInfo && (
              <Popup
                longitude={popupInfo.longitude}
                latitude={popupInfo.latitude}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
                closeButton={true}
                closeOnClick={false}
              >
                <div className="p-1 min-w-[160px]" data-testid="map-popup">
                  {popupInfo.type === 'city' && (
                    <>
                      <div className="text-sm font-semibold text-stone-900">{popupInfo.city}, {popupInfo.state}</div>
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
                      <div className="text-sm font-semibold text-stone-900">{popupInfo.county} County, {popupInfo.state}</div>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(popupInfo.layers || {}).filter(([l]) => activeLayers[l]).map(([layer, value]) => (
                          <div key={layer} className="text-xs text-stone-600 flex justify-between gap-3">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getDensityColor(layer, layerColors) }} />
                              {layer}:
                            </span>
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

          {/* Hover tooltip */}
          {hoverInfo && !popupInfo && (
            <div
              className="absolute pointer-events-none z-20 bg-stone-900/90 text-white text-xs rounded px-2.5 py-1.5 shadow-lg backdrop-blur-sm max-w-xs"
              style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 12 }}
              data-testid="hover-tooltip"
            >
              {hoverInfo.type === 'city' && (
                <span>{hoverInfo.city}, {hoverInfo.state} — {hoverInfo.layer}: {Number(hoverInfo.value).toLocaleString()}</span>
              )}
              {hoverInfo.type === 'county' && (
                <div>
                  <div className="font-medium">{hoverInfo.county} Co., {hoverInfo.state}</div>
                  {hoverInfo.detail && <div className="opacity-80 mt-0.5">{hoverInfo.detail}</div>}
                </div>
              )}
            </div>
          )}

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
