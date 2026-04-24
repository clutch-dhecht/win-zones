import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getLayerConfig, getRadiusLayers, getPointLayers, getDensityLayers, LAYER_GROUPS, getGroupedLayerNames } from '../config/layerConfig';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

const LayerItem = ({ layer, isActive, onToggle, color, onColorChange, radiusSetting, onRadiusChange, hasRadius, compact = false }) => {
  // Strip group prefix for display (e.g., "FSS Grain" → "Grain", "Terminals HRW Wheat" → "HRW Wheat")
  const displayName = compact ? layer.replace(/^(FSS |Terminals |Grain )/, '') : layer;

  return (
    <div
      className={`transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-40 hover:opacity-60'}`}
      data-testid={`layer-item-${layer}`}
    >
      <div
        className="flex items-center gap-2 py-1 cursor-pointer select-none"
        onClick={() => onToggle(layer)}
      >
        <ColorPicker color={color} onChange={(c) => onColorChange(layer, c)} layerName={layer} />
        <span className={`text-xs flex-1 ${isActive ? 'text-stone-800 font-medium' : 'text-stone-400'}`}>
          {displayName}
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

      {hasRadius && isActive && (
        <div className="ml-5 mb-1 flex items-center gap-1.5">
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

// Grouped sub-layer component with master toggle
const SubLayerGroup = ({ groupKey, group, allLayers, activeLayers, onToggle, layerColors, onColorChange, radiusSettings, onRadiusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const radiusCapableLayers = getRadiusLayers();

  // Filter to layers that exist in the data
  const presentLayers = group.layers.filter(l => allLayers.includes(l));
  if (presentLayers.length === 0) return null;

  const activeCount = presentLayers.filter(l => activeLayers[l]).length;
  const allActive = activeCount === presentLayers.length;
  const someActive = activeCount > 0 && !allActive;

  const toggleAll = () => {
    const targetState = !allActive;
    presentLayers.forEach(l => {
      if ((activeLayers[l] || false) !== targetState) {
        onToggle(l);
      }
    });
  };

  // Single-layer group: just show as a simple toggle, no expand
  if (presentLayers.length === 1) {
    const layer = presentLayers[0];
    const config = getLayerConfig(layer);
    return (
      <LayerItem
        layer={layer}
        isActive={activeLayers[layer] || false}
        onToggle={onToggle}
        color={layerColors[layer] || config.color}
        onColorChange={onColorChange}
        radiusSetting={radiusSettings[layer]}
        onRadiusChange={onRadiusChange}
        hasRadius={radiusCapableLayers.includes(layer)}
      />
    );
  }

  return (
    <div className="mb-1" data-testid={`sublayer-group-${groupKey}`}>
      <div className="flex items-center gap-2 py-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 flex-1 text-left"
        >
          {isOpen ? <ChevronDown className="w-3 h-3 text-stone-400" /> : <ChevronRight className="w-3 h-3 text-stone-400" />}
          <span className={`text-xs font-medium ${someActive || allActive ? 'text-stone-800' : 'text-stone-400'}`}>
            {group.label}
          </span>
          {activeCount > 0 && (
            <span className="text-[9px] bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded ml-1">{activeCount}</span>
          )}
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={allActive}
            onCheckedChange={toggleAll}
            className={`scale-75 ${someActive ? 'opacity-70' : ''}`}
            data-testid={`sublayer-toggle-all-${groupKey}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="ml-4 border-l border-stone-100 pl-2">
          {presentLayers.map(layer => {
            const config = getLayerConfig(layer);
            return (
              <LayerItem
                key={layer}
                layer={layer}
                isActive={activeLayers[layer] || false}
                onToggle={onToggle}
                color={layerColors[layer] || config.color}
                onColorChange={onColorChange}
                radiusSetting={radiusSettings[layer]}
                onRadiusChange={onRadiusChange}
                hasRadius={radiusCapableLayers.includes(layer)}
                compact={true}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const LayerControls = ({ allLayers, activeLayers, onToggle, radiusSettings, onRadiusChange, layerColors, onColorChange }) => {
  const pointLayerNames = getPointLayers();
  const densityLayerNames = getDensityLayers();
  const groupedLayerNames = getGroupedLayerNames();

  // Ungrouped point layers (not in any sub-layer group)
  const ungroupedPointLayers = allLayers.filter(l => pointLayerNames.includes(l) && !groupedLayerNames.has(l));
  const densityLayers = allLayers.filter(l => densityLayerNames.includes(l));
  const otherLayers = allLayers.filter(l => !pointLayerNames.includes(l) && !densityLayerNames.includes(l) && !groupedLayerNames.has(l));

  // Which groups have data present
  const activeGroups = Object.entries(LAYER_GROUPS).filter(
    ([, group]) => group.layers.some(l => allLayers.includes(l))
  );

  return (
    <div data-testid="layer-controls">
      {/* All point layers — ungrouped + grouped sub-layers together */}
      {(ungroupedPointLayers.length > 0 || activeGroups.length > 0) && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 py-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">Point Layers</span>
          </div>
          <div className="ml-1">
            {ungroupedPointLayers.map(layer => {
              const config = getLayerConfig(layer);
              return (
                <LayerItem
                  key={layer}
                  layer={layer}
                  isActive={activeLayers[layer] || false}
                  onToggle={onToggle}
                  color={layerColors[layer] || config.color}
                  onColorChange={onColorChange}
                  radiusSetting={radiusSettings[layer]}
                  onRadiusChange={onRadiusChange}
                  hasRadius={getRadiusLayers().includes(layer)}
                />
              );
            })}
            {activeGroups.map(([key, group]) => (
              <SubLayerGroup
                key={key}
                groupKey={key}
                group={group}
                allLayers={allLayers}
                activeLayers={activeLayers}
                onToggle={onToggle}
                layerColors={layerColors}
                onColorChange={onColorChange}
                radiusSettings={radiusSettings}
                onRadiusChange={onRadiusChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Density layers */}
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

      {/* Other */}
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
    </div>
  );
};

export default LayerControls;
