// Sales Rep Territory Configuration
// Based on the Wheat Sales Team Territory Map

export const SALES_REPS = [
  {
    id: 'laramie',
    name: 'Laramie Wiginton',
    color: '#DC2626',
    states: ['Wyoming', 'Montana', 'Idaho'],
    partialStates: {},
  },
  {
    id: 'sid',
    name: 'Sid Chambers',
    color: '#16A34A',
    states: ['New Mexico', 'Texas', 'Oklahoma'],
    partialStates: {},
  },
  {
    id: 'miya',
    name: 'Miya Butler',
    color: '#2563EB',
    states: ['Kansas', 'Missouri'],
    partialStates: {},
  },
  {
    id: 'matthew',
    name: 'Matthew Horlacher',
    color: '#EA580C',
    states: ['Washington', 'Oregon', 'California'],
    partialStates: {},
  },
  {
    id: 'tyler',
    name: 'Tyler Pierson',
    color: '#EAB308',
    states: ['South Dakota', 'Nebraska', 'Iowa', 'Minnesota', 'Colorado'],
    partialStates: {},
  },
  {
    id: 'natalie',
    name: 'Natalie Tokach',
    color: '#7C3AED',
    states: ['North Dakota'],
    partialStates: {},
  },
];

// Get the rep who owns a given state (full ownership)
export const getRepForState = (stateName) => {
  for (const rep of SALES_REPS) {
    if (rep.states.includes(stateName)) return rep;
  }
  return null;
};

// Get the rep for a county (handles partial states if any)
export const getRepForCounty = (stateName, countyLat) => {
  // Check full-state ownership
  const fullRep = getRepForState(stateName);
  if (fullRep) return fullRep;

  // Check partial states
  for (const rep of SALES_REPS) {
    const partial = rep.partialStates[stateName];
    if (partial) {
      if (partial.rule === 'south' && countyLat < partial.latThreshold) return rep;
      if (partial.rule === 'north' && countyLat >= partial.latThreshold) return rep;
    }
  }
  return null;
};

// Get all states a rep covers (including partial)
export const getRepStates = (repId) => {
  const rep = SALES_REPS.find(r => r.id === repId);
  if (!rep) return [];
  const states = [...rep.states];
  Object.keys(rep.partialStates).forEach(s => states.push(s));
  return states;
};
