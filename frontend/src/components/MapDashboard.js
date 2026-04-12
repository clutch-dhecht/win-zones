import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import MapboxVisualization from './MapboxVisualization';
import LayerControls from './LayerControls';
import Analytics from './Analytics';
import { toast } from 'sonner';
import { getLayerConfig } from '../config/layerConfig';

const MapDashboard = ({ apiUrl }) => {
  const [pointData, setPointData] = useState([]);
  const [densityData, setDensityData] = useState([]);
  const [allLayers, setAllLayers] = useState([]);
  const [activeLayers, setActiveLayers] = useState({});
  const [radiusSettings, setRadiusSettings] = useState({});
  const [layerColors, setLayerColors] = useState({});
  const [winZonesMode, setWinZonesMode] = useState(null); // null | 'coverage' | 'opportunity'
  const [winZoneRankings, setWinZoneRankings] = useState([]);
  const [topZones, setTopZones] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const initLayerSettings = (layers, prevActive, prevRadius) => {
    const newActive = { ...prevActive };
    const newRadius = { ...prevRadius };
    layers.forEach(layer => {
      if (!(layer in newActive)) newActive[layer] = true;
      const config = getLayerConfig(layer);
      if (config.radius?.enabled && !newRadius[layer]) {
        newRadius[layer] = { visible: false, miles: config.radius.default };
      }
    });
    return { newActive, newRadius };
  };

  const handlePointUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      const response = await axios.post(`${apiUrl}/upload/point`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Point data: ${response.data.processed} points processed, ${response.data.skipped} skipped`);
      const layers = response.data.layers || [];
      setAllLayers(prev => [...new Set([...prev, ...layers])]);
      const { newActive, newRadius } = initLayerSettings(layers, activeLayers, radiusSettings);
      setActiveLayers(newActive);
      setRadiusSettings(newRadius);
      await fetchPointData();
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDensityUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      const response = await axios.post(`${apiUrl}/upload/density`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Density data: ${response.data.processed} records merged (${response.data.total} total)`);
      const layers = response.data.layers || [];
      setAllLayers(prev => [...new Set([...prev, ...layers])]);
      const { newActive, newRadius } = initLayerSettings(layers, activeLayers, radiusSettings);
      setActiveLayers(newActive);
      setRadiusSettings(newRadius);
      await fetchDensityData();
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchPointData = async () => {
    try {
      const response = await axios.get(`${apiUrl}/data/point`);
      setPointData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching point data:', error);
    }
  };

  const fetchDensityData = async () => {
    try {
      const response = await axios.get(`${apiUrl}/data/density`);
      setDensityData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching density data:', error);
    }
  };

  const fetchTopZones = useCallback(async () => {
    try {
      const activeLayerNames = Object.keys(activeLayers).filter(key => activeLayers[key]);
      const response = await axios.get(`${apiUrl}/analytics/top-zones`, {
        params: { layers: activeLayerNames.join(',') }
      });
      setTopZones(response.data.top_zones || []);
      setTotalCount(response.data.total_count || 0);
    } catch (error) {
      console.error('Error fetching top zones:', error);
    }
  }, [activeLayers, apiUrl]);

  const toggleLayer = (layerKey) => {
    setActiveLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const handleRadiusChange = (layer, settings) => {
    setRadiusSettings(prev => ({ ...prev, [layer]: settings }));
  };

  const handleColorChange = (layer, color) => {
    setLayerColors(prev => ({ ...prev, [layer]: color }));
  };

  // Load existing data on mount
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const [pointResponse, densityResponse] = await Promise.all([
          axios.get(`${apiUrl}/data/point`),
          axios.get(`${apiUrl}/data/density`)
        ]);

        const pointLoaded = pointResponse.data.data || [];
        const densityLoaded = densityResponse.data.data || [];

        let combinedLayers = [];
        if (pointLoaded.length > 0) {
          setPointData(pointLoaded);
          combinedLayers = [...combinedLayers, ...Object.keys(pointLoaded[0].layers)];
        }
        if (densityLoaded.length > 0) {
          setDensityData(densityLoaded);
          // Collect ALL unique layer names across all density records
          const densityLayers = new Set();
          densityLoaded.forEach(d => Object.keys(d.layers).forEach(l => densityLayers.add(l)));
          combinedLayers = [...combinedLayers, ...densityLayers];
        }

        const uniqueLayers = [...new Set(combinedLayers)];
        setAllLayers(uniqueLayers);

        const { newActive, newRadius } = initLayerSettings(uniqueLayers, {}, {});
        setActiveLayers(newActive);
        setRadiusSettings(newRadius);
      } catch (error) {
        console.error('Error loading existing data:', error);
      }
    };

    loadExistingData();
  }, [apiUrl]);

  useEffect(() => {
    if (pointData.length > 0 || densityData.length > 0) {
      fetchTopZones();
    }
  }, [fetchTopZones, pointData, densityData]);

  const hasData = pointData.length > 0 || densityData.length > 0;

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-stone-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-72 lg:w-80 flex-shrink-0 border-r border-stone-200 bg-white h-full flex flex-col z-10 shadow-sm">
        <div className="px-5 pt-5 pb-4 border-b border-stone-100">
          <h1 className="text-2xl tracking-tight font-bold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Territory Atlas
          </h1>
          <p className="text-xs text-stone-400 mt-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Sales opportunity visualization
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* File Upload */}
          <div className="px-4 py-3 border-b border-stone-100">
            <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">
              Data Upload
            </label>
            <FileUpload
              onPointUpload={handlePointUpload}
              onDensityUpload={handleDensityUpload}
              loading={loading}
            />
          </div>

          {/* Layer Controls */}
          {hasData && (
            <div className="px-4 py-3 border-b border-stone-100">
              <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">
                Layers
              </label>
              <LayerControls
                allLayers={allLayers}
                activeLayers={activeLayers}
                onToggle={toggleLayer}
                radiusSettings={radiusSettings}
                onRadiusChange={handleRadiusChange}
                layerColors={layerColors}
                onColorChange={handleColorChange}
                winZonesEnabled={winZonesMode}
                onWinZonesToggle={setWinZonesMode}
                hasPointData={pointData.length > 0}
                hasDensityData={densityData.length > 0}
              />
            </div>
          )}

          {/* Analytics */}
          {hasData && (
            <div className="px-4 py-3">
              <label className="text-[10px] tracking-[0.08em] uppercase font-semibold text-stone-400 block mb-2">
                Top Opportunity Zones
              </label>
              <Analytics
                topZones={topZones}
                totalCount={totalCount}
                winZonesMode={winZonesMode}
                winZoneRankings={winZoneRankings}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Map */}
      <div className="flex-grow relative h-full bg-stone-50 flex flex-col">
        <MapboxVisualization
          pointData={pointData}
          densityData={densityData}
          activeLayers={activeLayers}
          radiusSettings={radiusSettings}
          layerColors={layerColors}
          winZonesEnabled={winZonesMode}
          onWinZoneRankings={setWinZoneRankings}
          hasData={hasData}
        />
      </div>
    </div>
  );
};

export default MapDashboard;
