import React from 'react';
import { BarChart3 } from 'lucide-react';

const Analytics = ({ topZones, totalCount }) => {
  return (
    <div className="bg-stone-50 rounded border border-stone-200 p-4" data-testid="analytics-panel">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-green-700" />
        <h3 className="text-sm font-medium text-stone-700">Top States</h3>
      </div>
      
      <div className="text-xs text-stone-500 mb-3">
        Total Opportunities: <span className="font-semibold text-stone-900">{totalCount.toLocaleString()}</span>
      </div>

      <div className="space-y-2">
        {topZones.slice(0, 10).map((zone, idx) => (
          <div key={zone.state} className="flex items-center justify-between py-1" data-testid={`top-zone-${idx}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-green-700 w-4">#{idx + 1}</span>
              <span className="text-sm text-stone-700">{zone.state}</span>
            </div>
            <span className="text-sm font-medium text-stone-900">{zone.total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {topZones.length === 0 && (
        <p className="text-xs text-stone-400 text-center py-4">No data available</p>
      )}
    </div>
  );
};

export default Analytics;
