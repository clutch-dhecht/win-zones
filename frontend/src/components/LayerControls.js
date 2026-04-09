import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

const LAYER_COLORS = [
  '#B45309', '#9F1239', '#15803D', '#0369A1',
  '#F59E0B', '#84CC16', '#14B8A6', '#7C3AED',
  '#DB2777', '#059669', '#2563EB', '#DC2626'
];

const LayerControls = ({ allLayers, activeLayers, onToggle }) => {
  return (
    <div className="space-y-2">
      {allLayers.map((layer, idx) => {
        const colorIndex = idx % LAYER_COLORS.length;
        return (
          <div key={layer} className="flex items-center justify-between py-1">
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: LAYER_COLORS[colorIndex] }}
              />
              <label htmlFor={layer} className="text-sm text-stone-700 cursor-pointer">
                {layer}
              </label>
            </div>
            <Checkbox
              id={layer}
              checked={activeLayers[layer] || false}
              onCheckedChange={() => onToggle(layer)}
              data-testid={`layer-toggle-${layer}`}
            />
          </div>
        );
      })}
    </div>
  );
};

export default LayerControls;
