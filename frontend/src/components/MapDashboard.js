import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import MapboxVisualization from './MapboxVisualization';
import LayerControls from './LayerControls';
import MarketViews, { getMarketPreset, detectActiveMarket } from './MarketViews';
import LayerStats from './LayerStats';
import StateFilter from './StateFilter';
import WinZoneCards from './WinZoneCards';
import { toast } from 'sonner';
import { getLayerConfig } from '../config/layerConfig';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  const [winZoneRankings, setWinZoneRankings] = useState([]);
  const [enrichedFeatures, setEnrichedFeatures] = useState([]);
  const [winZones, setWinZones] = useState([]);
  const [selectedStates, setSelectedStates] = useState(null); // string[] | null
  const [zoneFocus, setZoneFocus] = useState('regional'); // 'local' | 'regional' | 'territory'
  const [topZones, setTopZones] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
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
      if (preset) preset.layers.forEach(l => { newActive[l] = true; });
    }
    setActiveLayers(newActive);
  };

  const activeMarket = detectActiveMarket(activeLayers);

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
        const { newActive, newRadius } = initLayerSettings(unique, {}, {});
        setActiveLayers(newActive);
        setRadiusSettings(newRadius);
      } catch (e) { console.error(e); }
    };
    loadExistingData();
  }, [apiUrl]);

  useEffect(() => {
    if (pointData.length > 0 || locationData.length > 0 || densityData.length > 0) fetchTopZones();
  }, [fetchTopZones, pointData, locationData, densityData]);

  const hasData = pointData.length > 0 || locationData.length > 0 || densityData.length > 0;

  // Filter data by selected state for stats
  const matchesStateFilter = (stateName) => {
    if (!selectedStates || selectedStates.length === 0) return true;
    const normalized = stateName.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return selectedStates.includes(normalized);
  };

  const filteredPointData = selectedStates ? pointData.filter(d => matchesStateFilter(d.state)) : pointData;
  const filteredLocationData = selectedStates ? locationData.filter(d => matchesStateFilter(d.state)) : locationData;
  const filteredDensityData = selectedStates ? densityData.filter(d => matchesStateFilter(d.state)) : densityData;

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

      {/* State Filter */}
      {hasData && (
        <div className="px-4 py-2 border-b border-stone-100">
          <StateFilter
            selectedStates={selectedStates}
            onStatesChange={setSelectedStates}
            densityData={densityData}
            locationData={locationData}
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
              <Switch checked={!!winZonesMode} onCheckedChange={(checked) => setWinZonesMode(checked ? 'coverage' : null)} className="scale-75" data-testid="win-zones-toggle" />
            </div>
          </div>
          {winZonesMode && (
            <div className="ml-5 mt-1.5 flex items-center gap-1">
              <button onClick={() => setWinZonesMode('coverage')} className={`text-[10px] px-2 py-1 rounded transition-colors ${winZonesMode === 'coverage' ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`} data-testid="win-mode-coverage">Coverage</button>
              <button onClick={() => setWinZonesMode('opportunity')} className={`text-[10px] px-2 py-1 rounded transition-colors ${winZonesMode === 'opportunity' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`} data-testid="win-mode-opportunity">Opportunity</button>
              <button
                onClick={() => setShowZoneFocus(v => !v)}
                className="text-[10px] text-stone-400 hover:text-stone-600 ml-auto"
              >
                {showZoneFocus ? 'Hide' : 'Adjust'}
              </button>
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
            </div>
          )}
          <p className="text-[10px] text-stone-400 ml-5 mt-1 leading-tight">
            {!winZonesMode && 'Strategic overlay for coverage & opportunity'}
            {winZonesMode === 'coverage' && 'Where you ARE — your existing footprint'}
            {winZonesMode === 'opportunity' && 'Where you\'re NOT — highest density gaps'}
          </p>
        </div>
      )}

      {/* Win Zone Cards */}
      {hasData && winZonesMode && enrichedFeatures.length > 0 && (
        <div className="px-4 py-3 border-b border-stone-100">
          <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">
            {winZonesMode === 'coverage' ? 'Top Coverage Zones' : 'Top Opportunity Zones'}
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
          />
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
        <h1 className="text-lg font-bold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>CLS Win Zones</h1>
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
            <h1 className="text-2xl tracking-tight font-bold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>CLS Win Zones</h1>
            <p className="text-xs text-stone-400 mt-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Market opportunity analysis</p>
          </div>
          <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
        </div>

        {/* Map */}
        <div className="flex-grow relative h-full bg-stone-50 flex flex-col">
          <MapboxVisualization
            pointData={pointData}
            locationData={locationData}
            densityData={densityData}
            activeLayers={activeLayers}
            radiusSettings={radiusSettings}
            layerColors={layerColors}
            winZonesEnabled={winZonesMode}
            winZones={winZones}
            onWinZoneRankings={setWinZoneRankings}
            onEnrichedFeatures={setEnrichedFeatures}
            onMapZoom={(fn) => { mapZoomRef.current = fn; }}
            selectedStates={selectedStates}
            hasData={hasData}
          />
        </div>
      </div>
    </div>
  );
};

export default MapDashboard;
