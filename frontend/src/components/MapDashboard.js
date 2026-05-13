import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import MapboxVisualization from './MapboxVisualization';
import LayerControls from './LayerControls';
import MarketViews, { getMarketPreset, detectActiveMarket, DEFAULT_MARKET_KEY } from './MarketViews';
import LayerStats from './LayerStats';
import StateFilter from './StateFilter';
import SalesRepFilter from './SalesRepFilter';
import WinZoneCards from './WinZoneCards';
import WeightedWinZones from './WeightedWinZones';
import SalesTerritories from './SalesTerritories';
import { SALES_REPS, getRepStates } from '../config/territoryConfig';
import { toast } from 'sonner';
import { getLayerConfig, LAYER_GROUPS } from '../config/layerConfig';
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const MapDashboard = ({ apiUrl }) => {
  const [pointData, setPointData] = useState([]);
  const [locationData, setLocationData] = useState([]);
  const [densityData, setDensityData] = useState([]);
  const [allLayers, setAllLayers] = useState([]);
  const [activeLayers, setActiveLayers] = useState({});
  const [radiusSettings, setRadiusSettings] = useState({});
  const [layerColors, setLayerColors] = useState({});
  const [winZonesMode, setWinZonesMode] = useState(null);
  const [winZoneSpotlight, setWinZoneSpotlight] = useState(false);
  const [selectedMarketKey, setSelectedMarketKey] = useState(null);
  const [winZoneRankings, setWinZoneRankings] = useState([]);
  const [enrichedFeatures, setEnrichedFeatures] = useState([]);
  const [winZones, setWinZones] = useState([]);
  const [weightedWinEnabled, setWeightedWinEnabled] = useState(false);
  const [weightedWinZones, setWeightedWinZones] = useState([]);
  const [weightedSettings, setWeightedSettings] = useState({
    weights: { opportunity: 0.6, access: 0.3, efficiency: 0.1 },
    constants: {},
  });
  const [showWeightedSettings, setShowWeightedSettings] = useState(false);
  const [showAdvancedWinZones, setShowAdvancedWinZones] = useState(false);
  const [selectedStates, setSelectedStates] = useState(null); // string[] | null
  const [selectedRepIds, setSelectedRepIds] = useState(null); // string[] | null
  const [countiesGeoJSON, setCountiesGeoJSON] = useState(null); // fetched once, used for rep-county lat-split
  const [zoneFocus, setZoneFocus] = useState('regional'); // 'local' | 'regional' | 'territory'
  const [topZones, setTopZones] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [territoriesEnabled, setTerritoriesEnabled] = useState(false);
  const [visibleReps, setVisibleReps] = useState({});
  const [winZonesPerRep, setWinZonesPerRep] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showZoneFocus, setShowZoneFocus] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mapZoomRef = useRef(null);

  const initLayerSettings = (layers, prevActive, prevRadius) => {
    const newActive = { ...prevActive };
    const newRadius = { ...prevRadius };
    layers.forEach(layer => {
      if (!(layer in newActive)) newActive[layer] = false;
      const config = getLayerConfig(layer);
      if (config.radius?.enabled && !newRadius[layer]) {
        newRadius[layer] = { visible: false, miles: config.radius.default };
      }
    });
    return { newActive, newRadius };
  };

  const handleMarketSelect = (marketKey) => {
    const newActive = {};
    allLayers.forEach(l => { newActive[l] = false; });
    if (marketKey && marketKey !== 'custom') {
      const preset = getMarketPreset(marketKey);
      if (preset) {
        preset.layers.forEach(l => { newActive[l] = true; });
        if (preset.enableTerritories) {
          setTerritoriesEnabled(true);
          if (preset.defaultReps) {
            const reps = {};
            SALES_REPS.forEach(r => { reps[r.id] = preset.defaultReps.includes(r.id); });
            setVisibleReps(reps);
          }
        } else {
          setTerritoriesEnabled(false);
        }
        // Auto-apply rep filter spotlight when the preset specifies one
        if (preset.defaultRepIds && preset.defaultRepIds.length > 0) {
          setSelectedRepIds(preset.defaultRepIds);
          // Also sync the state filter to the union of these reps' states
          const stateUnion = new Set();
          preset.defaultRepIds.forEach(id => getRepStates(id).forEach(s => stateUnion.add(s)));
          setSelectedStates(stateUnion.size > 0 ? Array.from(stateUnion) : null);
        } else {
          // Clear rep filter when switching to a market that doesn't specify one
          setSelectedRepIds(null);
          setSelectedStates(null);
        }
      }
      setSelectedMarketKey(marketKey);
    } else {
      setTerritoriesEnabled(false);
      setSelectedMarketKey(null);
      setSelectedRepIds(null);
      setSelectedStates(null);
    }
    setActiveLayers(newActive);
  };

  // The user's last-selected market sticks even after they toggle individual layers off.
  // The derived value (detectActiveMarket) is used for the "Custom" indicator when the
  // current layer set diverges from the selected preset.
  const derivedMarket = detectActiveMarket(activeLayers);
  const activeMarket = selectedMarketKey || derivedMarket;

  const handlePointUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      const response = await axios.post(`${apiUrl}/upload/point`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const layerAdded = response.data.layer_added;
      toast.success(`Uploaded: ${response.data.processed} ${layerAdded || 'points'}`);
      const layers = response.data.layers || [];
      setAllLayers(prev => [...new Set([...prev, ...layers])]);
      const { newActive, newRadius } = initLayerSettings(layers, activeLayers, radiusSettings);
      if (layerAdded) newActive[layerAdded] = true;
      setActiveLayers(newActive);
      setRadiusSettings(newRadius);
      await Promise.all([fetchPointData(), fetchLocationData()]);
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally { setLoading(false); }
  };

  const handleDensityUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      const response = await axios.post(`${apiUrl}/upload/density`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Density data: ${response.data.processed} records merged`);
      const layers = response.data.layers || [];
      setAllLayers(prev => [...new Set([...prev, ...layers])]);
      const { newActive, newRadius } = initLayerSettings(layers, activeLayers, radiusSettings);
      setActiveLayers(newActive);
      setRadiusSettings(newRadius);
      await fetchDensityData();
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally { setLoading(false); }
  };

  const fetchPointData = async () => { try { setPointData((await axios.get(`${apiUrl}/data/point`)).data.data || []); } catch (e) { console.error(e); } };
  const fetchLocationData = async () => { try { setLocationData((await axios.get(`${apiUrl}/data/locations`)).data.data || []); } catch (e) { console.error(e); } };
  const fetchDensityData = async () => { try { setDensityData((await axios.get(`${apiUrl}/data/density`)).data.data || []); } catch (e) { console.error(e); } };

  const fetchTopZones = useCallback(async () => {
    try {
      const activeLayerNames = Object.keys(activeLayers).filter(key => activeLayers[key]);
      const response = await axios.get(`${apiUrl}/analytics/top-zones`, { params: { layers: activeLayerNames.join(',') } });
      setTopZones(response.data.top_zones || []);
      setTotalCount(response.data.total_count || 0);
    } catch (e) { console.error(e); }
  }, [activeLayers, apiUrl]);

  const toggleLayer = (layerKey) => { setActiveLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] })); };
  const handleRadiusChange = (layer, settings) => { setRadiusSettings(prev => ({ ...prev, [layer]: settings })); };
  const handleColorChange = (layer, color) => { setLayerColors(prev => ({ ...prev, [layer]: color })); };

  const handleZoomToZone = useCallback((zone) => {
    if (mapZoomRef.current && zone.bbox) {
      mapZoomRef.current(zone.bbox);
    }
    setMobileOpen(false);
  }, []);

  const handleRepToggle = (repId) => {
    setVisibleReps(prev => ({ ...prev, [repId]: prev[repId] === false ? true : false }));
  };

  const handleZoomToRep = useCallback((rep) => {
    // Simple bbox lookup by state centers
    const STATE_BOUNDS = {
      'Wyoming': { minLat: 41, maxLat: 45, minLon: -111, maxLon: -104 },
      'Montana': { minLat: 44.5, maxLat: 49, minLon: -116, maxLon: -104 },
      'New Mexico': { minLat: 31.5, maxLat: 37, minLon: -109, maxLon: -103 },
      'Texas': { minLat: 25.8, maxLat: 36.5, minLon: -106.5, maxLon: -93.5 },
      'Oklahoma': { minLat: 33.6, maxLat: 37, minLon: -103, maxLon: -94.5 },
      'Kansas': { minLat: 37, maxLat: 40, minLon: -102, maxLon: -94.5 },
      'Missouri': { minLat: 36, maxLat: 40.6, minLon: -95.8, maxLon: -89 },
      'Arizona': { minLat: 31.3, maxLat: 37, minLon: -114.8, maxLon: -109 },
      'California': { minLat: 32.5, maxLat: 42, minLon: -124.5, maxLon: -114 },
      'Oregon': { minLat: 42, maxLat: 46.3, minLon: -124.5, maxLon: -116.5 },
      'Washington': { minLat: 45.5, maxLat: 49, minLon: -124.8, maxLon: -117 },
      'Idaho': { minLat: 42, maxLat: 49, minLon: -117, maxLon: -111 },
      'Utah': { minLat: 37, maxLat: 42, minLon: -114, maxLon: -109 },
      'Nevada': { minLat: 35, maxLat: 42, minLon: -120, maxLon: -114 },
      'South Dakota': { minLat: 42.5, maxLat: 46, minLon: -104.1, maxLon: -96.5 },
      'Nebraska': { minLat: 40, maxLat: 43, minLon: -104, maxLon: -95.3 },
      'Iowa': { minLat: 40.4, maxLat: 43.5, minLon: -96.6, maxLon: -90 },
      'Minnesota': { minLat: 43.5, maxLat: 49.4, minLon: -97.2, maxLon: -89.5 },
      'Colorado': { minLat: 37, maxLat: 41, minLon: -109, maxLon: -102 },
      'North Dakota': { minLat: 45.9, maxLat: 49, minLon: -104.1, maxLon: -96.5 },
    };
    const repStates = getRepStates(rep.id);
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    repStates.forEach(s => {
      const b = STATE_BOUNDS[s];
      if (b) {
        minLat = Math.min(minLat, b.minLat); maxLat = Math.max(maxLat, b.maxLat);
        minLon = Math.min(minLon, b.minLon); maxLon = Math.max(maxLon, b.maxLon);
      }
    });
    if (mapZoomRef.current && minLat < 90) {
      mapZoomRef.current({ minLat: minLat - 0.5, maxLat: maxLat + 0.5, minLon: minLon - 0.5, maxLon: maxLon + 0.5 });
    }
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const [pointResp, locResp, densityResp] = await Promise.all([
          axios.get(`${apiUrl}/data/point`), axios.get(`${apiUrl}/data/locations`), axios.get(`${apiUrl}/data/density`)
        ]);
        const pLoaded = pointResp.data.data || [];
        const lLoaded = locResp.data.data || [];
        const dLoaded = densityResp.data.data || [];
        let combined = [];
        if (pLoaded.length > 0) { setPointData(pLoaded); const s = new Set(); pLoaded.forEach(d => Object.keys(d.layers).forEach(l => s.add(l))); combined = [...combined, ...s]; }
        if (lLoaded.length > 0) { setLocationData(lLoaded); const s = new Set(); lLoaded.forEach(d => s.add(d.layer)); combined = [...combined, ...s]; }
        if (dLoaded.length > 0) { setDensityData(dLoaded); const s = new Set(); dLoaded.forEach(d => Object.keys(d.layers).forEach(l => s.add(l))); combined = [...combined, ...s]; }
        const unique = [...new Set(combined)];
        setAllLayers(unique);
        // Default to Wheat ABM market view on initial load
        const defaultPreset = getMarketPreset(DEFAULT_MARKET_KEY);
        const newActive = {};
        unique.forEach(l => { newActive[l] = false; });
        if (defaultPreset) defaultPreset.layers.forEach(l => { if (unique.includes(l)) newActive[l] = true; });
        setActiveLayers(newActive);
        setSelectedMarketKey(DEFAULT_MARKET_KEY);
        const { newRadius } = initLayerSettings(unique, newActive, {});
        setRadiusSettings(newRadius);
        // Apply territory + rep-filter state per the default preset's policy
        if (defaultPreset && defaultPreset.enableTerritories) {
          setTerritoriesEnabled(true);
          if (defaultPreset.defaultReps) {
            const reps = {};
            SALES_REPS.forEach(r => { reps[r.id] = defaultPreset.defaultReps.includes(r.id); });
            setVisibleReps(reps);
          }
        }
        if (defaultPreset && defaultPreset.defaultRepIds && defaultPreset.defaultRepIds.length > 0) {
          setSelectedRepIds(defaultPreset.defaultRepIds);
          const stateUnion = new Set();
          defaultPreset.defaultRepIds.forEach(id => getRepStates(id).forEach(s => stateUnion.add(s)));
          setSelectedStates(stateUnion.size > 0 ? Array.from(stateUnion) : null);
        }
      } catch (e) { console.error(e); }
    };
    loadExistingData();
  }, [apiUrl]);

  useEffect(() => {
    if (pointData.length > 0 || locationData.length > 0 || densityData.length > 0) fetchTopZones();
  }, [fetchTopZones, pointData, locationData, densityData]);

  // Keep the territory overlay (visibleReps) in sync with the rep filter
  // (selectedRepIds). When the user removes a rep from the filter, their
  // territory fill and border should disappear from the overlay too.
  useEffect(() => {
    if (!selectedRepIds) return;
    const reps = {};
    SALES_REPS.forEach(r => { reps[r.id] = selectedRepIds.includes(r.id); });
    setVisibleReps(reps);
  }, [selectedRepIds]);

  // Auto-select the default market once data is available and nothing is active yet
  const defaultMarketAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultMarketAppliedRef.current) return;
    if (pointData.length === 0 && locationData.length === 0 && densityData.length === 0) return;
    const anyActive = Object.values(activeLayers).some(Boolean);
    if (anyActive) { defaultMarketAppliedRef.current = true; return; }
    handleMarketSelect(DEFAULT_MARKET_KEY);
    defaultMarketAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointData, locationData, densityData]);

  const hasData = pointData.length > 0 || locationData.length > 0 || densityData.length > 0;

  // Filter data by selected state(s). MEMOIZED to keep the reference stable across
  // re-renders — without this, .filter() creates a new array each render which
  // cascades through the child useMemos and triggers an enrichedFeatures->setState
  // feedback loop.
  const matchesStateFilter = useCallback((stateName) => {
    if (!selectedStates || selectedStates.length === 0) return true;
    const normalized = String(stateName || '').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return selectedStates.includes(normalized);
  }, [selectedStates]);

  const filteredPointData = useMemo(
    () => selectedStates ? pointData.filter(d => matchesStateFilter(d.state)) : pointData,
    [pointData, selectedStates, matchesStateFilter]
  );
  const filteredLocationData = useMemo(
    () => selectedStates ? locationData.filter(d => matchesStateFilter(d.state)) : locationData,
    [locationData, selectedStates, matchesStateFilter]
  );
  const filteredDensityData = useMemo(
    () => selectedStates ? densityData.filter(d => matchesStateFilter(d.state)) : densityData,
    [densityData, selectedStates, matchesStateFilter]
  );

  // Win-zone spotlight county set — memoized so the Set reference is stable across
  // renders. Without this, MapboxVisualization useMemo deps see a "new" Set every
  // parent render and feedback-loop through onEnrichedFeatures.
  const winZoneSpotlightKeys = useMemo(() => {
    if (!winZoneSpotlight || !winZones || winZones.length === 0) return null;
    const keys = new Set();
    winZones.forEach(z => (z.countyIds || []).forEach(k => keys.add(String(k).toUpperCase())));
    return keys.size > 0 ? keys : null;
  }, [winZoneSpotlight, winZones]);

  // Rep-filter county spotlight — built from countiesGeoJSON so Montana's lat split
  // is honored (Matthew = north of 47.5, Laramie = south).
  const FIPS_TO_STATE_NAME = useMemo(() => ({
    "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California","08":"Colorado","09":"Connecticut","10":"Delaware",
    "11":"District of Columbia","12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa",
    "20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota",
    "28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico",
    "36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania","44":"Rhode Island",
    "45":"South Carolina","46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington",
    "54":"West Virginia","55":"Wisconsin","56":"Wyoming"
  }), []);

  const repSpotlightKeys = useMemo(() => {
    if (!selectedRepIds || selectedRepIds.length === 0 || !countiesGeoJSON) return null;
    const reps = selectedRepIds.map(id => SALES_REPS.find(r => r.id === id)).filter(Boolean);
    if (reps.length === 0) return null;
    // Index counties by state for fast lookup
    const fullStates = new Set();
    const partialStateRules = {}; // stateName -> [{rule, latThreshold}]
    reps.forEach(rep => {
      (rep.states || []).forEach(s => fullStates.add(s));
      Object.entries(rep.partialStates || {}).forEach(([s, def]) => {
        if (fullStates.has(s)) return; // full coverage trumps partial
        if (!partialStateRules[s]) partialStateRules[s] = [];
        partialStateRules[s].push(def);
      });
    });
    const keys = new Set();
    countiesGeoJSON.features.forEach(feat => {
      const stateName = FIPS_TO_STATE_NAME[feat.properties.STATE];
      if (!stateName) return;
      const countyName = feat.properties.NAME || '';
      const key = `${stateName.toUpperCase()}|${countyName.toUpperCase()}`;
      if (fullStates.has(stateName)) {
        keys.add(key);
        return;
      }
      const partials = partialStateRules[stateName];
      if (!partials) return;
      // Compute a rough centroid for lat check
      const geom = feat.geometry;
      if (!geom) return;
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      let sumLat = 0, count = 0;
      for (const poly of polys) {
        for (const c of poly[0]) {
          sumLat += c[1];
          count++;
          if (count >= 50) break;
        }
        if (count >= 50) break;
      }
      const lat = count > 0 ? sumLat / count : null;
      if (lat === null) return;
      for (const p of partials) {
        if ((p.rule === 'south' && lat < p.latThreshold) ||
            (p.rule === 'north' && lat >= p.latThreshold)) {
          keys.add(key);
          break;
        }
      }
    });
    return keys.size > 0 ? keys : null;
  }, [selectedRepIds, countiesGeoJSON, FIPS_TO_STATE_NAME]);

  // Combine win-zone and rep spotlights via intersection. Null on any side passes through.
  const spotlightCountyKeys = useMemo(() => {
    if (!winZoneSpotlightKeys && !repSpotlightKeys) return null;
    if (!winZoneSpotlightKeys) return repSpotlightKeys;
    if (!repSpotlightKeys) return winZoneSpotlightKeys;
    const out = new Set();
    repSpotlightKeys.forEach(k => { if (winZoneSpotlightKeys.has(k)) out.add(k); });
    return out;
  }, [winZoneSpotlightKeys, repSpotlightKeys]);

  const sidebarContent = (
    <>
      {/* Market Views */}
      {hasData && (
        <div className="px-4 py-3 border-b border-stone-100">
          <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">Market Views</label>
          <MarketViews
            activeLayers={activeLayers} allLayers={allLayers}
            onMarketSelect={(key) => { handleMarketSelect(key); setMobileOpen(false); }}
            activeMarket={activeMarket}
          />
        </div>
      )}

      {/* State + Sales Rep filters */}
      {hasData && (
        <div className="px-4 py-2 border-b border-stone-100 space-y-1.5">
          <StateFilter
            selectedStates={selectedStates}
            onStatesChange={setSelectedStates}
            densityData={densityData}
            locationData={locationData}
          />
          <SalesRepFilter
            selectedRepIds={selectedRepIds}
            onRepIdsChange={setSelectedRepIds}
            onStatesChange={setSelectedStates}
            selectedStates={selectedStates}
          />
        </div>
      )}

      {/* Layer Stats */}
      {hasData && Object.values(activeLayers).some(v => v) && (
        <div className="px-4 py-3 border-b border-stone-100">
          <LayerStats
            activeLayers={activeLayers}
            pointData={filteredPointData}
            locationData={filteredLocationData}
            densityData={filteredDensityData}
            presetLayers={activeMarket && activeMarket !== 'custom' ? (getMarketPreset(activeMarket)?.layers || null) : null}
            onLayerToggle={(layerName) => {
              setActiveLayers(prev => {
                const next = { ...prev };
                const group = Object.values(LAYER_GROUPS).find(g => g.summary === 'group' && ((g.layers || []).includes(layerName) || g.label === layerName));
                if (group) {
                  const turningOff = (group.layers || []).some(l => prev[l]);
                  (group.layers || []).forEach(l => { next[l] = !turningOff; });
                } else {
                  next[layerName] = !prev[layerName];
                }
                return next;
              });
            }}
            onLayerHideOthers={(layerName) => {
              // Resolve the clicked card to the set of layers it represents
              const group = Object.values(LAYER_GROUPS).find(g => g.summary === 'group' && ((g.layers || []).includes(layerName) || g.label === layerName));
              const keepSet = new Set(group ? (group.layers || []) : [layerName]);
              setActiveLayers(prev => {
                const next = {};
                Object.keys(prev).forEach(l => { next[l] = keepSet.has(l) ? true : false; });
                // Make sure the kept layer(s) get turned on even if not currently in prev
                keepSet.forEach(l => { next[l] = true; });
                return next;
              });
            }}
            onLayerResetMarket={() => {
              if (activeMarket && activeMarket !== 'custom') {
                handleMarketSelect(activeMarket);
              }
            }}
          />
        </div>
      )}

      {/* Win Zones */}
      {hasData && (pointData.length > 0 || locationData.length > 0) && densityData.length > 0 && (
        <div className="px-4 py-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-gradient-to-r from-orange-500 to-red-600" />
            <span className={`text-sm flex-1 font-medium ${winZonesMode ? 'text-red-700' : 'text-stone-400'}`}>Win Zones</span>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch checked={!!winZonesMode} onCheckedChange={(checked) => setWinZonesMode(checked ? 'market' : null)} className="scale-75" data-testid="win-zones-toggle" />
            </div>
          </div>
          {winZonesMode && (
            <div className="ml-5 mt-1.5 flex items-center gap-1">
              <button onClick={() => setWinZonesMode('market')} className={`text-[10px] px-2 py-1 rounded transition-colors ${winZonesMode === 'market' ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`} data-testid="win-mode-market">Market</button>
              <button onClick={() => setWinZonesMode('coverage')} className={`text-[10px] px-2 py-1 rounded transition-colors ${winZonesMode === 'coverage' ? 'bg-purple-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`} data-testid="win-mode-coverage">Coverage</button>
              <button onClick={() => setWinZonesMode('opportunity')} className={`text-[10px] px-2 py-1 rounded transition-colors ${winZonesMode === 'opportunity' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`} data-testid="win-mode-opportunity">Opportunity</button>
              <button
                onClick={() => setShowZoneFocus(v => !v)}
                className="text-[10px] text-stone-400 hover:text-stone-600 ml-auto"
              >
                {showZoneFocus ? 'Hide' : 'Adjust'}
              </button>
            </div>
          )}
          {winZonesMode && (
            <div className="ml-5 mt-1.5 flex items-center gap-2">
              <label className="text-[10px] text-stone-600 flex items-center gap-1.5 cursor-pointer" htmlFor="win-zone-spotlight-toggle">
                <Switch
                  id="win-zone-spotlight-toggle"
                  checked={winZoneSpotlight}
                  onCheckedChange={setWinZoneSpotlight}
                  className="scale-[0.65]"
                  data-testid="win-zone-spotlight-toggle"
                />
                Spotlight zones
              </label>
              <span className="text-[9px] text-stone-400">
                {winZoneSpotlight ? 'Map shows only zone counties' : 'Map shows everything'}
              </span>
            </div>
          )}
          {winZonesMode && showZoneFocus && (
            <div className="ml-5 mt-1.5 flex items-center gap-1">
              <span className="text-[10px] text-stone-400 mr-1">Focus:</span>
              {[
                { key: 'local', label: 'Local' },
                { key: 'regional', label: 'Regional' },
                { key: 'territory', label: 'Territory' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setZoneFocus(opt.key)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    zoneFocus === opt.key
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                  data-testid={`zone-focus-${opt.key}`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setWinZonesPerRep(v => !v)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ml-1 ${
                  winZonesPerRep ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
                data-testid="zone-per-rep"
              >
                Per Rep
              </button>
            </div>
          )}
          <p className="text-[10px] text-stone-400 ml-5 mt-1 leading-tight">
            {!winZonesMode && 'Strategic overlay for coverage & opportunity'}
            {winZonesMode === 'market' && 'Where the biggest markets are'}
            {winZonesMode === 'coverage' && 'Where you ARE — your existing footprint'}
            {winZonesMode === 'opportunity' && 'Where you\'re NOT — highest density gaps'}
          </p>
        </div>
      )}

      {/* Win Zone Cards */}
      {hasData && winZonesMode && enrichedFeatures.length > 0 && (
        <div className="px-4 py-3 border-b border-stone-100">
          <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">
            {winZonesMode === 'market' ? 'Top Market Zones' : winZonesMode === 'coverage' ? 'Top Coverage Zones' : 'Top Opportunity Zones'}
          </label>
          <WinZoneCards
            enrichedFeatures={enrichedFeatures}
            activeLayers={activeLayers}
            winZonesMode={winZonesMode}
            selectedStates={selectedStates}
            zoneFocus={zoneFocus}
            densityData={densityData}
            locationData={locationData}
            pointData={pointData}
            onZoomToZone={handleZoomToZone}
            onZonesComputed={setWinZones}
            perRep={winZonesPerRep}
          />
        </div>
      )}

      {/* Sales Territories */}
      {hasData && (
        <div className="px-4 py-3 border-b border-stone-100">
          <SalesTerritories
            enabled={territoriesEnabled}
            onToggle={setTerritoriesEnabled}
            visibleReps={visibleReps}
            onRepToggle={handleRepToggle}
            onZoomToRep={handleZoomToRep}
          />
        </div>
      )}

      {/* Advanced Win Zone Settings — hidden for now, code preserved */}
      {false && hasData && densityData.length > 0 && (
        <div className="border-b border-stone-100">
          <button
            onClick={() => setShowAdvancedWinZones(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-50/50 transition-colors"
            data-testid="advanced-win-zones-toggle"
          >
            {showAdvancedWinZones ? <ChevronDown className="w-3.5 h-3.5 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 text-stone-400" />}
            <span className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400">Advanced Win Zone Settings</span>
          </button>
          {showAdvancedWinZones && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600" />
                <span className={`text-sm flex-1 font-medium ${weightedWinEnabled ? 'text-cyan-700' : 'text-stone-400'}`}>Weighted Win Zones</span>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={weightedWinEnabled} onCheckedChange={setWeightedWinEnabled} className="scale-75" data-testid="weighted-win-toggle" />
                </div>
              </div>
              {weightedWinEnabled && (
                <>
                  <p className="text-[10px] text-stone-400 ml-5 mt-1 leading-tight">
                    Opportunity + Access + Efficiency model
                    {activeMarket && activeMarket !== 'custom' && <span className="text-cyan-500 ml-1">({activeMarket})</span>}
                  </p>
                  <button
                    onClick={() => setShowWeightedSettings(v => !v)}
                    className="text-[10px] text-stone-400 hover:text-stone-600 ml-5 mt-1 flex items-center gap-1"
                    data-testid="weighted-settings-toggle"
                  >
                    <Settings2 className="w-3 h-3" />
                    {showWeightedSettings ? 'Hide settings' : 'Advanced settings'}
                  </button>
                </>
              )}
              {weightedWinEnabled && showWeightedSettings && (
                <div className="ml-5 mt-2 p-2 bg-stone-50 rounded-lg border border-stone-100 space-y-2">
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400">Weights</div>
                  {[
                    { key: 'opportunity', label: 'Opportunity', color: 'amber' },
                    { key: 'access', label: 'Access', color: 'cyan' },
                    { key: 'efficiency', label: 'Efficiency', color: 'emerald' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`text-[10px] text-${color}-600 w-16`}>{label}</span>
                      <input
                        type="range" min="0" max="100" step="5"
                        value={Math.round((weightedSettings.weights[key] || 0) * 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setWeightedSettings(prev => ({
                            ...prev,
                            weights: { ...prev.weights, [key]: val }
                          }));
                        }}
                        className="flex-1 h-1 accent-stone-600"
                        data-testid={`weight-slider-${key}`}
                      />
                      <span className="text-[10px] text-stone-500 w-8 text-right">{Math.round((weightedSettings.weights[key] || 0) * 100)}%</span>
                    </div>
                  ))}
                  {['wheat', 'corn', 'rice'].includes(activeMarket) && (
                    <>
                      <div className="text-[9px] uppercase tracking-wider font-semibold text-stone-400 pt-1">Efficiency Constants ({activeMarket})</div>
                      {[
                        { key: 'requiredGrowers', label: 'Required Growers', defaults: { wheat: 137, corn: 16, rice: 23 } },
                        { key: 'impressions', label: 'Impressions', defaults: { wheat: 915, corn: 108, rice: 150 } },
                      ].map(({ key, label, defaults }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-500 w-24">{label}</span>
                          <input
                            type="number"
                            value={weightedSettings.constants[activeMarket]?.[key] ?? defaults[activeMarket] ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setWeightedSettings(prev => ({
                                ...prev,
                                constants: {
                                  ...prev.constants,
                                  [activeMarket]: { ...prev.constants[activeMarket], [key]: val }
                                }
                              }));
                            }}
                            className="flex-1 text-[10px] px-2 py-0.5 border border-stone-200 rounded bg-white text-stone-700 w-16"
                            data-testid={`efficiency-${key}`}
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              {/* Weighted Win Zone Cards */}
              {weightedWinEnabled && enrichedFeatures.length > 0 && (
                <div className="mt-3">
                  <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">
                    Weighted Zones {activeMarket && activeMarket !== 'custom' ? `(${activeMarket})` : ''}
                  </label>
                  <WeightedWinZones
                    enrichedFeatures={enrichedFeatures}
                    activeMarket={activeMarket}
                    selectedStates={selectedStates}
                    zoneFocus={zoneFocus}
                    locationData={locationData}
                    modelWeights={weightedSettings.weights}
                    efficiencyConstants={weightedSettings.constants}
                    onZoomToZone={handleZoomToZone}
                    onZonesComputed={setWeightedWinZones}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Data Layers (Advanced) */}
      {hasData && (
        <div className="border-b border-stone-100">
          <button onClick={() => setAdvancedOpen(!advancedOpen)} className="flex items-center gap-1.5 w-full px-4 py-2.5 text-left hover:bg-stone-50 transition-colors" data-testid="advanced-toggle">
            {advancedOpen ? <ChevronDown className="w-3 h-3 text-stone-400" /> : <ChevronRight className="w-3 h-3 text-stone-400" />}
            <span className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400">Data Layers (Advanced)</span>
            {activeMarket === 'custom' && <span className="ml-auto text-[9px] bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded">Custom</span>}
          </button>
          {advancedOpen && (
            <div className="px-4 pb-3">
              <div className="mb-3">
                <FileUpload onPointUpload={handlePointUpload} onDensityUpload={handleDensityUpload} loading={loading} />
              </div>
              <LayerControls allLayers={allLayers} activeLayers={activeLayers} onToggle={toggleLayer} radiusSettings={radiusSettings} onRadiusChange={handleRadiusChange} layerColors={layerColors} onColorChange={handleColorChange} />
            </div>
          )}
        </div>
      )}

      {!hasData && (
        <div className="px-4 py-3 border-b border-stone-100">
          <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">Data Upload</label>
          <FileUpload onPointUpload={handlePointUpload} onDensityUpload={handleDensityUpload} loading={loading} />
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-stone-100 overflow-hidden">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-stone-200 z-20">
        <h1 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#D15E13' }}>CLS Win Zones</h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-medium" data-testid="mobile-menu-toggle">
          {mobileOpen ? 'Close' : 'Menu'}
          {activeMarket && activeMarket !== 'custom' && !mobileOpen && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] capitalize">{activeMarket}</span>}
        </button>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="md:hidden absolute inset-0 z-30 flex" style={{ top: '48px' }}>
          <div className="w-full max-w-sm bg-white shadow-xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 48px)' }}>{sidebarContent}</div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-72 lg:w-80 flex-shrink-0 border-r border-stone-200 bg-white h-full flex-col z-10 shadow-sm">
          <div className="px-5 pt-5 pb-4 border-b border-stone-100">
            <h1 className="text-2xl tracking-tight font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#D15E13' }}>CLS Win Zones</h1>
            <p className="text-xs text-stone-400 mt-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Market opportunity analysis</p>
          </div>
          <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
        </div>

        {/* Map */}
        <div className="flex-grow relative h-full bg-stone-50 flex flex-col">
          <MapboxVisualization
            pointData={filteredPointData}
            locationData={filteredLocationData}
            densityData={filteredDensityData}
            activeLayers={activeLayers}
            radiusSettings={radiusSettings}
            layerColors={layerColors}
            winZonesEnabled={winZonesMode}
            winZones={winZones}
            weightedWinZones={weightedWinEnabled ? weightedWinZones : []}
            territoriesEnabled={territoriesEnabled}
            visibleReps={visibleReps}
            onWinZoneRankings={setWinZoneRankings}
            onEnrichedFeatures={setEnrichedFeatures}
            onMapZoom={(fn) => { mapZoomRef.current = fn; }}
            selectedStates={selectedStates}
            hasData={hasData}
            gateByDensityLayers={activeMarket && activeMarket !== 'custom' ? (getMarketPreset(activeMarket)?.gateByDensityLayers || null) : null}
            spotlightCountyKeys={spotlightCountyKeys}
            onCountiesLoaded={setCountiesGeoJSON}
            gateMode={activeMarket && activeMarket !== 'custom' ? (getMarketPreset(activeMarket)?.gateMode || 'any') : 'any'}
          />
        </div>
      </div>
    </div>
  );
};

export default MapDashboard;
