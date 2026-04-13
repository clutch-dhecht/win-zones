import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getLayerConfig, getRadiusLayers, getPointLayers, getDensityLayers } from '../config/layerConfig';
import { ChevronDown, ChevronRight, Palette } from 'lucide-react';

const RADIUS_OPTIONS = [25, 50, 100];

const PRESET_COLORS = [
  '#0369A1', '#0891B2', '#14B8A6', '#15803D', '#84CC16',
  '#F59E0B', '#F97316', '#B45309', '#DC2626', '#9F1239',
  '#7C3AED', '#A855F7', '#EC4899', '#6B7280', '#1C1917',
];

const ColorPicker = ({ color, onChange, layerName }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-1 ring-stone-300 hover:ring-2 hover:ring-stone-400 transition-all cursor-pointer"
          style={{ backgroundColor: color }}
          data-testid={`color-picker-${layerName}`}
          title="Change color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="right" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${c === color ? 'ring-2 ring-stone-800 ring-offset-1' : 'ring-1 ring-stone-200'}`}
              style={{ backgroundColor: c }}
              data-testid={`color-option-${c.replace('#', '')}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const LayerItem = ({ layer, isActive, config, onToggle, color, onColorChange, radiusSetting, onRadiusChange, hasRadius }) => {
  return (
    <div
      className={`transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-40 hover:opacity-60'}`}
      data-testid={`layer-item-${layer}`}
    >
      <div
        className="flex items-center gap-2 py-1.5 cursor-pointer select-none"
        onClick={() => onToggle(layer)}
      >
        <ColorPicker color={color} onChange={(c) => onColorChange(layer, c)} layerName={layer} />
        <span className={`text-sm flex-1 ${isActive ? 'text-stone-800 font-medium' : 'text-stone-400'}`}>
          {layer}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={isActive}
            onCheckedChange={() => onToggle(layer)}
            className="scale-75"
            data-testid={`layer-toggle-${layer}`}
          />
        </div>
      </div>

      {/* Radius controls */}
      {hasRadius && isActive && (
        <div className="ml-5 mb-1.5 flex items-center gap-1.5">
          <Switch
            checked={radiusSetting?.visible || false}
            onCheckedChange={(checked) => {
              onRadiusChange(layer, { ...radiusSetting, visible: checked });
            }}
            className="scale-[0.6]"
            data-testid={`radius-toggle-${layer}`}
          />
          <span className="text-[10px] text-stone-400 mr-1">Radius</span>
          {radiusSetting?.visible && (
            <div className="flex gap-0.5">
              {RADIUS_OPTIONS.map(miles => (
                <button
                  key={miles}
                  onClick={() => onRadiusChange(layer, { ...radiusSetting, miles })}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    radiusSetting.miles === miles
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                  data-testid={`radius-miles-${layer}-${miles}`}
                >
                  {miles}mi
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LayerGroup = ({ title, layers, activeLayers, onToggle, layerColors, onColorChange, radiusSettings, onRadiusChange, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const radiusCapableLayers = getRadiusLayers();
  const activeCount = layers.filter(l => activeLayers[l]).length;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full text-left py-1"
        data-testid={`layer-group-${title}`}
      >
        {isOpen ? <ChevronDown className="w-3 h-3 text-stone-400" /> : <ChevronRight className="w-3 h-3 text-stone-400" />}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">{title}</span>
        <span className="text-[10px] text-stone-300 ml-auto">{activeCount}/{layers.length}</span>
      </button>

      {isOpen && (
        <div className="ml-1">
          {layers.map(layer => {
            const config = getLayerConfig(layer);
            return (
              <LayerItem
                key={layer}
                layer={layer}
                isActive={activeLayers[layer] || false}
                config={config}
                onToggle={onToggle}
                color={layerColors[layer] || config.color}
                onColorChange={onColorChange}
                radiusSetting={radiusSettings[layer]}
                onRadiusChange={onRadiusChange}
                hasRadius={radiusCapableLayers.includes(layer)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const LayerControls = ({ allLayers, activeLayers, onToggle, radiusSettings, onRadiusChange, layerColors, onColorChange, winZonesEnabled, onWinZonesToggle, hasPointData, hasDensityData }) => {
  const pointLayerNames = getPointLayers();
  const densityLayerNames = getDensityLayers();

  const pointLayers = allLayers.filter(l => pointLayerNames.includes(l));
  const densityLayers = allLayers.filter(l => densityLayerNames.includes(l));
  const otherLayers = allLayers.filter(l => !pointLayerNames.includes(l) && !densityLayerNames.includes(l));

  const canShowWinZones = hasPointData && hasDensityData;

  return (
    <div data-testid="layer-controls">
      {pointLayers.length > 0 && (
        <LayerGroup
          title="Point Layers"
          layers={pointLayers}
          activeLayers={activeLayers}
          onToggle={onToggle}
          layerColors={layerColors}
          onColorChange={onColorChange}
          radiusSettings={radiusSettings}
          onRadiusChange={onRadiusChange}
        />
      )}
      {densityLayers.length > 0 && (
        <LayerGroup
          title="Density Layers"
          layers={densityLayers}
          activeLayers={activeLayers}
          onToggle={onToggle}
          layerColors={layerColors}
          onColorChange={onColorChange}
          radiusSettings={radiusSettings}
          onRadiusChange={onRadiusChange}
        />
      )}
      {otherLayers.length > 0 && (
        <LayerGroup
          title="Other"
          layers={otherLayers}
          activeLayers={activeLayers}
          onToggle={onToggle}
          layerColors={layerColors}
          onColorChange={onColorChange}
          radiusSettings={radiusSettings}
          onRadiusChange={onRadiusChange}
        />
      )}

      {/* Win Zones Analysis */}
      {canShowWinZones && (
        <div className="mt-3 pt-3 border-t border-stone-200">
          <div className="flex items-center gap-2 py-1">
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-gradient-to-r from-orange-500 to-red-600" />
            <span className={`text-sm flex-1 font-medium ${winZonesEnabled ? 'text-red-700' : 'text-stone-400'}`}>
              Win Zones
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={!!winZonesEnabled}
                onCheckedChange={(checked) => onWinZonesToggle(checked ? 'opportunity' : null)}
                className="scale-75"
                data-testid="win-zones-toggle"
              />
            </div>
          </div>

          {winZonesEnabled && (
            <div className="ml-5 mt-1 flex gap-1">
              <button
                onClick={() => onWinZonesToggle('coverage')}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  winZonesEnabled === 'coverage'
                    ? 'bg-green-700 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
                data-testid="win-mode-coverage"
              >
                Coverage
              </button>
              <button
                onClick={() => onWinZonesToggle('opportunity')}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  winZonesEnabled === 'opportunity'
                    ? 'bg-orange-600 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
                data-testid="win-mode-opportunity"
              >
                Opportunity
              </button>
            </div>
          )}

          <p className="text-[10px] text-stone-400 ml-5 mt-1 leading-tight">
            {!winZonesEnabled && 'Overlay showing coverage & opportunity'}
            {winZonesEnabled === 'coverage' && 'Where you ARE — your existing footprint'}
            {winZonesEnabled === 'opportunity' && 'Where you\'re NOT — highest density gaps'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LayerControls;
