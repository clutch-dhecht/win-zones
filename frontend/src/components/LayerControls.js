import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const LAYER_COLORS = {
  city_0: '#B45309',
  city_1: '#9F1239',
  city_2: '#15803D',
  city_3: '#0369A1',
  county_0: '#F59E0B',
  county_1: '#84CC16',
  county_2: '#14B8A6'
};

const LayerControls = ({ cityLayers, countyLayers, activeLayers, onToggle }) => {
  return (
    <Accordion type="multiple" defaultValue={['city', 'county']} className="w-full">
      {cityLayers.length > 0 && (
        <AccordionItem value="city" className="border-stone-200">
          <AccordionTrigger className="text-sm font-medium text-stone-700 hover:no-underline" data-testid="city-layers-accordion">
            City Layers ({cityLayers.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {cityLayers.map((layer, idx) => {
                const layerKey = `city_${layer}`;
                const colorKey = `city_${idx}`;
                return (
                  <div key={layerKey} className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: LAYER_COLORS[colorKey] || '#166534' }}
                      />
                      <label htmlFor={layerKey} className="text-sm text-stone-700 cursor-pointer">
                        {layer}
                      </label>
                    </div>
                    <Checkbox
                      id={layerKey}
                      checked={activeLayers[layerKey] || false}
                      onCheckedChange={() => onToggle(layerKey)}
                      data-testid={`layer-toggle-${layerKey}`}
                    />
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}

      {countyLayers.length > 0 && (
        <AccordionItem value="county" className="border-stone-200">
          <AccordionTrigger className="text-sm font-medium text-stone-700 hover:no-underline" data-testid="county-layers-accordion">
            County Layers ({countyLayers.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {countyLayers.map((layer, idx) => {
                const layerKey = `county_${layer}`;
                const colorKey = `county_${idx}`;
                return (
                  <div key={layerKey} className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: LAYER_COLORS[colorKey] || '#166534' }}
                      />
                      <label htmlFor={layerKey} className="text-sm text-stone-700 cursor-pointer">
                        {layer}
                      </label>
                    </div>
                    <Checkbox
                      id={layerKey}
                      checked={activeLayers[layerKey] || false}
                      onCheckedChange={() => onToggle(layerKey)}
                      data-testid={`layer-toggle-${layerKey}`}
                    />
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
};

export default LayerControls;
