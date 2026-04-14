import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, X } from 'lucide-react';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

const StateFilter = ({ selectedStates, onStatesChange, densityData, locationData }) => {
  const [open, setOpen] = useState(false);

  const statesWithData = useMemo(() => {
    const stateSet = new Set();
    (densityData || []).forEach(d => {
      const s = d.state.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      stateSet.add(s);
    });
    (locationData || []).forEach(d => {
      const s = d.state.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      stateSet.add(s);
    });
    return US_STATES.filter(s => stateSet.has(s));
  }, [densityData, locationData]);

  const selected = selectedStates || [];

  const toggleState = (state) => {
    if (selected.includes(state)) {
      const next = selected.filter(s => s !== state);
      onStatesChange(next.length > 0 ? next : null);
    } else {
      onStatesChange([...selected, state]);
    }
  };

  const clearAll = () => onStatesChange(null);

  const label = selected.length === 0
    ? 'All States'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} states`;

  return (
    <div data-testid="state-filter">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-2 w-full h-8 px-2.5 text-xs bg-white border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
            data-testid="state-filter-select"
          >
            <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
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
              <span className="text-[10px] text-stone-400 uppercase font-semibold">Filter by State</span>
              {selected.length > 0 && (
                <button onClick={clearAll} className="text-[10px] text-stone-400 hover:text-stone-600">
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {statesWithData.map(state => (
              <label
                key={state}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-stone-50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(state)}
                  onCheckedChange={() => toggleState(state)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-stone-700">{state}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected state pills */}
      {selected.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(state => (
            <span
              key={state}
              className="inline-flex items-center gap-0.5 text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded"
            >
              {state}
              <X
                className="w-2.5 h-2.5 cursor-pointer hover:text-stone-900"
                onClick={() => toggleState(state)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default StateFilter;
