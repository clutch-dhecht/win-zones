import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import MapVisualization from './MapVisualization';
import LayerControls from './LayerControls';
import Analytics from './Analytics';
import { toast } from 'sonner';

const MapDashboard = ({ apiUrl }) => {
  const [cityData, setCityData] = useState([]);
  const [countyData, setCountyData] = useState([]);
  const [cityLayers, setCityLayers] = useState([]);
  const [countyLayers, setCountyLayers] = useState([]);
  const [activeLayers, setActiveLayers] = useState({});
  const [topZones, setTopZones] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleCityUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const response = await axios.post(`${apiUrl}/upload/city`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`City data uploaded: ${response.data.processed} cities processed, ${response.data.skipped} skipped`);
      
      // Set layers and activate all by default
      const layers = response.data.layers || [];
      setCityLayers(layers);
      const newActive = { ...activeLayers };
      layers.forEach(layer => {
        newActive[`city_${layer}`] = true;
      });
      setActiveLayers(newActive);
      
      // Fetch the data
      await fetchCityData();
    } catch (error) {
      toast.error('Failed to upload city data: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCountyUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const response = await axios.post(`${apiUrl}/upload/county`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`County data uploaded: ${response.data.processed} counties processed`);
      
      // Set layers and activate all by default
      const layers = response.data.layers || [];
      setCountyLayers(layers);
      const newActive = { ...activeLayers };
      layers.forEach(layer => {
        newActive[`county_${layer}`] = true;
      });
      setActiveLayers(newActive);
      
      // Fetch the data
      await fetchCountyData();
    } catch (error) {
      toast.error('Failed to upload county data: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchCityData = async () => {
    try {
      const response = await axios.get(`${apiUrl}/data/city`);
      setCityData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching city data:', error);
    }
  };

  const fetchCountyData = async () => {
    try {
      const response = await axios.get(`${apiUrl}/data/county`);
      setCountyData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching county data:', error);
    }
  };

  const fetchTopZones = async () => {
    try {
      const activeLayerNames = Object.keys(activeLayers)
        .filter(key => activeLayers[key])
        .map(key => key.replace('city_', '').replace('county_', ''));
      
      const response = await axios.get(`${apiUrl}/analytics/top-zones`, {
        params: { layers: activeLayerNames.join(',') }
      });
      
      setTopZones(response.data.top_zones || []);
      setTotalCount(response.data.total_count || 0);
    } catch (error) {
      console.error('Error fetching top zones:', error);
    }
  };

  const toggleLayer = (layerKey) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerKey]: !prev[layerKey]
    }));
  };

  // Fetch existing data on mount
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const [cityResponse, countyResponse] = await Promise.all([
          axios.get(`${apiUrl}/data/city`),
          axios.get(`${apiUrl}/data/county`)
        ]);
        
        const cityDataLoaded = cityResponse.data.data || [];
        const countyDataLoaded = countyResponse.data.data || [];
        
        if (cityDataLoaded.length > 0) {
          setCityData(cityDataLoaded);
          // Extract layer names from first item
          const layers = Object.keys(cityDataLoaded[0].layers);
          setCityLayers(layers);
          const newActive = {};
          layers.forEach(layer => {
            newActive[`city_${layer}`] = true;
          });
          setActiveLayers(prev => ({ ...prev, ...newActive }));
        }
        
        if (countyDataLoaded.length > 0) {
          setCountyData(countyDataLoaded);
          // Extract layer names from first item
          const layers = Object.keys(countyDataLoaded[0].layers);
          setCountyLayers(layers);
          const newActive = {};
          layers.forEach(layer => {
            newActive[`county_${layer}`] = true;
          });
          setActiveLayers(prev => ({ ...prev, ...newActive }));
        }
      } catch (error) {
        console.error('Error loading existing data:', error);
      }
    };
    
    loadExistingData();
  }, [apiUrl]);

  useEffect(() => {
    if (cityData.length > 0 || countyData.length > 0) {
      fetchTopZones();
    }
  }, [activeLayers, cityData, countyData]);

  const hasData = cityData.length > 0 || countyData.length > 0;

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-stone-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-stone-200 bg-white h-full flex flex-col z-10 shadow-sm">
        <div className="p-6 border-b border-stone-200">
          <h1 className="text-4xl tracking-tight font-bold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Territory Atlas
          </h1>
          <p className="text-sm text-stone-500 mt-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Visualize sales opportunities across the US
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* File Upload Section */}
          <div className="p-4 border-b border-stone-200">
            <label className="text-xs tracking-[0.05em] uppercase font-semibold text-stone-500 block mb-3">
              Data Upload
            </label>
            <FileUpload
              onCityUpload={handleCityUpload}
              onCountyUpload={handleCountyUpload}
              loading={loading}
            />
          </div>

          {/* Layer Controls */}
          {hasData && (
            <div className="p-4 border-b border-stone-200">
              <label className="text-xs tracking-[0.05em] uppercase font-semibold text-stone-500 block mb-3">
                Layer Controls
              </label>
              <LayerControls
                cityLayers={cityLayers}
                countyLayers={countyLayers}
                activeLayers={activeLayers}
                onToggle={toggleLayer}
              />
            </div>
          )}

          {/* Analytics */}
          {hasData && (
            <div className="p-4">
              <label className="text-xs tracking-[0.05em] uppercase font-semibold text-stone-500 block mb-3">
                Top Opportunity Zones
              </label>
              <Analytics topZones={topZones} totalCount={totalCount} />
            </div>
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-grow relative h-full bg-stone-50 flex flex-col">
        <MapVisualization
          cityData={cityData}
          countyData={countyData}
          activeLayers={activeLayers}
          hasData={hasData}
        />
      </div>
    </div>
  );
};

export default MapDashboard;
