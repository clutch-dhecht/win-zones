import React from 'react';
import { BarChart3, Target, MapPin } from 'lucide-react';

const Analytics = ({ topZones, totalCount, winZonesMode, winZoneRankings }) => {
  // When Win Zones is active and we have rankings, show win zone table
  if (winZonesMode && winZoneRankings && winZoneRankings.length > 0) {
    const isCoverage = winZonesMode === 'coverage';
    const title = isCoverage ? 'Your Coverage' : 'Top Opportunities';
    const subtitle = isCoverage
      ? 'Counties closest to your existing points'
      : 'Highest density + lowest existing coverage';
    const Icon = isCoverage ? MapPin : Target;
    const accentColor = isCoverage ? 'blue' : 'orange';
    const bgClass = isCoverage ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200';
    const titleClass = isCoverage ? 'text-green-800' : 'text-orange-800';
    const subtitleClass = isCoverage ? 'text-green-500' : 'text-orange-500';
    const iconClass = isCoverage ? 'text-green-600' : 'text-orange-600';
    const borderClass = isCoverage ? 'border-green-100' : 'border-orange-100';

    const getScoreColor = (score) => {
      if (isCoverage) {
        return score >= 70 ? 'text-green-800' : score >= 40 ? 'text-green-600' : 'text-yellow-600';
      }
      return score >= 70 ? 'text-red-600' : score >= 40 ? 'text-orange-600' : 'text-amber-600';
    };

    const getRankColor = (idx) => {
      if (isCoverage) {
        return idx < 3 ? 'text-green-700' : idx < 7 ? 'text-green-500' : 'text-yellow-600';
      }
      return idx < 3 ? 'text-red-600' : idx < 7 ? 'text-orange-600' : 'text-amber-600';
    };

    return (
      <div className={`rounded border p-3 ${bgClass}`} data-testid="analytics-panel">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${iconClass}`} />
          <h3 className={`text-sm font-semibold ${titleClass}`}>{title}</h3>
        </div>
        <p className={`text-[10px] ${subtitleClass} mb-2.5`}>{subtitle}</p>

        <div className="space-y-1">
          {winZoneRankings.slice(0, 15).map((zone, idx) => (
            <div
              key={`${zone.county}-${zone.state}-${idx}`}
              className={`flex items-center gap-2 py-1 border-b last:border-0 ${borderClass}`}
              data-testid={`win-zone-${idx}`}
            >
              <span className={`text-[10px] font-bold w-5 text-right ${getRankColor(idx)}`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-stone-800 truncate">
                  {zone.county}, {zone.state}
                </div>
                {zone.nearestMiles != null && (
                  <div className="text-[10px] text-stone-400">
                    {zone.nearestMiles}mi to nearest
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-xs font-bold ${getScoreColor(zone.score)}`}>
                  {zone.score}%
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
