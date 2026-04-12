import React from 'react';
import { BarChart3, Target } from 'lucide-react';

const Analytics = ({ topZones, totalCount, winZonesEnabled, winZoneRankings }) => {
  // When Win Zones is ON and we have rankings, show Win Zone table
  if (winZonesEnabled && winZoneRankings && winZoneRankings.length > 0) {
    return (
      <div className="bg-orange-50 rounded border border-orange-200 p-3" data-testid="analytics-panel">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold text-orange-800">Top Win Zones</h3>
        </div>
        <p className="text-[10px] text-orange-500 mb-2.5">
          Counties with highest density + lowest existing coverage
        </p>

        <div className="space-y-1">
          {winZoneRankings.slice(0, 15).map((zone, idx) => (
            <div
              key={`${zone.county}-${zone.state}`}
              className="flex items-center gap-2 py-1 border-b border-orange-100 last:border-0"
              data-testid={`win-zone-${idx}`}
            >
              <span className={`text-[10px] font-bold w-5 text-right ${
                idx < 3 ? 'text-red-600' : idx < 7 ? 'text-orange-600' : 'text-amber-600'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-stone-800 truncate">
                  {zone.county}, {zone.state}
                </div>
                {zone.nearestMiles != null && (
                  <div className="text-[10px] text-stone-400">
                    {zone.nearestMiles}mi to nearest point
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-xs font-bold ${
                  zone.winScore >= 70 ? 'text-red-600' : zone.winScore >= 40 ? 'text-orange-600' : 'text-amber-600'
                }`}>
                  {zone.winScore}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: Top States view
  return (
    <div className="bg-stone-50 rounded border border-stone-200 p-3" data-testid="analytics-panel">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-green-700" />
        <h3 className="text-sm font-medium text-stone-700">Top States</h3>
      </div>

      <div className="text-xs text-stone-500 mb-2.5">
        Total Opportunities: <span className="font-semibold text-stone-900">{totalCount.toLocaleString()}</span>
      </div>

      <div className="space-y-1">
        {topZones.slice(0, 10).map((zone, idx) => (
          <div key={zone.state} className="flex items-center justify-between py-1" data-testid={`top-zone-${idx}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-green-700 w-5 text-right">#{idx + 1}</span>
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
