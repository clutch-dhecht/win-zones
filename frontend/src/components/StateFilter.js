import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

// All US states for the dropdown
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

const StateFilter = ({ selectedState, onStateChange, densityData, locationData }) => {
  // Only show states that have data
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

  return (
    <div className="flex items-center gap-2" data-testid="state-filter">
      <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
      <Select value={selectedState || 'all'} onValueChange={(v) => onStateChange(v === 'all' ? null : v)}>
        <SelectTrigger className="w-full h-8 text-xs bg-white" data-testid="state-filter-select">
          <SelectValue placeholder="All States" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="all">All States</SelectItem>
          {statesWithData.map(state => (
            <SelectItem key={state} value={state}>{state}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default StateFilter;
