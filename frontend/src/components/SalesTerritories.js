import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronRight, Eye, EyeOff, Crosshair } from 'lucide-react';
import { SALES_REPS } from '../config/territoryConfig';

const SalesTerritories = ({ enabled, onToggle, visibleReps, onRepToggle, onZoomToRep }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div data-testid="sales-territories">
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0 border-2 border-stone-400" />
        <span className={`text-sm flex-1 font-medium ${enabled ? 'text-stone-800' : 'text-stone-400'}`}>Sales Territories</span>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={enabled} onCheckedChange={onToggle} className="scale-75" data-testid="territories-toggle" />
        </div>
      </div>

      {enabled && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 ml-5 mt-1 text-[10px] text-stone-400 hover:text-stone-600"
            data-testid="territories-expand"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? 'Collapse' : 'Filter by rep'}
          </button>

          {expanded && (
            <div className="ml-4 mt-1.5 space-y-1">
              {SALES_REPS.map(rep => {
                const isVisible = visibleReps[rep.id] !== false;
                return (
                  <div
                    key={rep.id}
                    className={`flex items-center gap-2 py-0.5 ${isVisible ? 'opacity-100' : 'opacity-40'}`}
                    data-testid={`territory-rep-${rep.id}`}
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: rep.color }}
                    />
                    <span className="text-[11px] text-stone-700 flex-1 truncate">{rep.name}</span>
                    <button
                      onClick={() => onRepToggle(rep.id)}
                      className="p-0.5 rounded hover:bg-stone-100 transition-colors"
                      title={isVisible ? 'Hide territory' : 'Show territory'}
                      data-testid={`territory-eye-${rep.id}`}
                    >
                      {isVisible
                        ? <Eye className="w-3 h-3 text-stone-500" />
                        : <EyeOff className="w-3 h-3 text-stone-300" />
                      }
                    </button>
                    <button
                      onClick={() => onZoomToRep(rep)}
                      className="p-0.5 rounded hover:bg-stone-100 transition-colors"
                      title="Zoom to territory"
                      data-testid={`territory-zoom-${rep.id}`}
                    >
                      <Crosshair className="w-3 h-3 text-stone-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesTerritories;
