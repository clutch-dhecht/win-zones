import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { getLayerConfig, getRadiusLayers } from '../config/layerConfig';

const RADIUS_OPTIONS = [25, 50, 100];

const LayerControls = ({ allLayers, activeLayers, onToggle, radiusSettings, onRadiusChange }) => {
  const radiusCapableLayers = getRadiusLayers();

  return (
    <div className="space-y-1">
      {allLayers.map((layer) => {
        const config = getLayerConfig(layer);
        const isActive = activeLayers[layer] || false;
        const hasRadius = radiusCapableLayers.includes(layer);
        const radiusSetting = radiusSettings[layer] || { visible: false, miles: config.radius?.default || 50 };

        return (
          <div key={layer} className="py-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <label htmlFor={layer} className="text-sm text-stone-700 cursor-pointer leading-tight">
                  {layer}
                </label>
              </div>
              <Checkbox
                id={layer}
                checked={isActive}
                onCheckedChange={() => onToggle(layer)}
                data-testid={`layer-toggle-${layer}`}
              />
            </div>

            {/* Radius controls - only shown for radius-capable layers when active */}
            {hasRadius && isActive && (
              <div className="mt-1.5 ml-5 p-2 bg-stone-50 rounded border border-stone-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-stone-500">Radius</span>
                  <Switch
                    checked={radiusSetting.visible}
                    onCheckedChange={(checked) => {
                      onRadiusChange(layer, { ...radiusSetting, visible: checked });
                    }}
                    data-testid={`radius-toggle-${layer}`}
                  />
                </div>
                {radiusSetting.visible && (
                  <div className="flex gap-1">
                    {RADIUS_OPTIONS.map(miles => (
                      <button
                        key={miles}
                        onClick={() => onRadiusChange(layer, { ...radiusSetting, miles })}
                        className={`flex-1 text-xs py-1 rounded border transition-colors ${
                          radiusSetting.miles === miles
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
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
      })}
    </div>
  );
};

export default LayerControls;
