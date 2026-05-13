import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { User, X } from 'lucide-react';
import { SALES_REPS, getRepStates } from '../config/territoryConfig';

/**
 * Multi-select rep filter. Selecting one or more reps sets the state filter to
 * the union of their territories so the existing state-filter spotlight kicks
 * in automatically — pins, choropleth deciles, win zones all re-scope.
 *
 * Partial-state precision (the Montana split for Laramie/Matthew) isn't applied;
 * each rep contributes its full-state set. The territory overlay still draws
 * the precise boundaries.
 */
const SalesRepFilter = ({ selectedRepIds, onRepIdsChange, onStatesChange, selectedStates }) => {
  const [open, setOpen] = useState(false);

  const selected = selectedRepIds || [];
  const selectedReps = SALES_REPS.filter(r => selected.includes(r.id));

  // Union of states across all selected reps
  const unionStates = (repIds) => {
    const s = new Set();
    (repIds || []).forEach(id => getRepStates(id).forEach(st => s.add(st)));
    return Array.from(s);
  };

  const toggleRep = (repId) => {
    const next = selected.includes(repId)
      ? selected.filter(id => id !== repId)
      : [...selected, repId];
    onRepIdsChange(next.length > 0 ? next : null);
    const states = unionStates(next);
    onStatesChange(states.length > 0 ? states : null);
  };

  const clearAll = () => {
    onRepIdsChange(null);
    onStatesChange(null);
  };

  // If the state filter is changed manually (or by other UI) so that it no
  // longer matches the union of the selected reps' territories, quietly clear
  // the rep selection to avoid a stale pill.
  useEffect(() => {
    if (selected.length === 0) return;
    const repUnion = unionStates(selected);
    const filterStates = selectedStates || [];
    if (filterStates.length !== repUnion.length) { onRepIdsChange(null); return; }
    const setA = new Set(filterStates);
    if (!repUnion.every(s => setA.has(s))) onRepIdsChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStates]);

  const label = selected.length === 0
    ? 'All Reps'
    : selected.length === 1
      ? selectedReps[0]?.name || 'All Reps'
      : `${selected.length} reps`;

  return (
    <div data-testid="rep-filter">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-2 w-full h-8 px-2.5 text-xs bg-white border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
            data-testid="rep-filter-select"
          >
            {selected.length === 1 && selectedReps[0] ? (
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: selectedReps[0].color }} />
            ) : (
              <User className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
            )}
            <span className={`flex-1 text-left truncate ${selected.length > 0 ? 'text-stone-800 font-medium' : 'text-stone-500'}`}>
              {label}
            </span>
            {selected.length > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
                className="p-0.5 rounded hover:bg-stone-200 text-stone-400"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <div className="p-2 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-400 uppercase font-semibold">Spotlight by Rep</span>
              {selected.length > 0 && (
                <button onClick={clearAll} className="text-[10px] text-stone-400 hover:text-stone-600">
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {SALES_REPS.map(rep => (
              <label
                key={rep.id}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-stone-50 cursor-pointer"
                data-testid={`rep-filter-option-${rep.id}`}
              >
                <Checkbox
                  checked={selected.includes(rep.id)}
                  onCheckedChange={() => toggleRep(rep.id)}
                  className="h-3.5 w-3.5"
                />
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: rep.color }} />
                <span className="flex-1 text-xs text-stone-700 truncate">{rep.name}</span>
                <span className="text-[10px] text-stone-400">{getRepStates(rep.id).length} st</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected rep pills */}
      {selected.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedReps.map(rep => (
            <span
              key={rep.id}
              className="inline-flex items-center gap-1 text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded"
            >
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: rep.color }} />
              {rep.name}
              <X
                className="w-2.5 h-2.5 cursor-pointer hover:text-stone-900"
                onClick={() => toggleRep(rep.id)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesRepFilter;
