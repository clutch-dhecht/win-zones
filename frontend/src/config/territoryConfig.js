// Sales Rep Territory Configuration
// Territory assignments per user specification

export const SALES_REPS = [
  {
    id: 'laramie',
    name: 'Laramie Wiginton',
    color: '#DC2626',
    states: ['Wyoming'],
    partialStates: { Montana: { rule: 'south', latThreshold: 47.5 } },
  },
  {
    id: 'sid',
    name: 'Sid Chambers',
    color: '#16A34A',
    states: ['New Mexico', 'Texas'],
    partialStates: {},
  },
  {
    id: 'miya',
    name: 'Miya Butler',
    color: '#2563EB',
    states: ['Oklahoma', 'Kansas', 'Missouri'],
    partialStates: {},
  },
  {
    id: 'matthew',
    name: 'Matthew Horlacher',
    color: '#EA580C',
    states: ['Arizona', 'California', 'Oregon', 'Washington', 'Idaho'],
    partialStates: { Montana: { rule: 'north', latThreshold: 47.5 } },
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

// Get the rep for a county (handles Montana split)
export const getRepForCounty = (stateName, countyLat) => {
  // Check full-state ownership
  const fullRep = getRepForState(stateName);
  if (fullRep) return fullRep;

  // Check partial states (Montana split at 47.5)
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
