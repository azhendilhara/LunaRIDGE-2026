import React, { useState } from 'react';
import { VisibilityWindow } from '../types/api';
import { Radio, Sun, ChevronRight, Clock, Award, ShieldAlert } from 'lucide-react';

interface WindowsTableProps {
  earthWindows: VisibilityWindow[];
  solarWindows: VisibilityWindow[];
}

export const WindowsTable: React.FC<WindowsTableProps> = ({
  earthWindows,
  solarWindows,
}) => {
  const [activeTab, setActiveTab] = useState<'earth' | 'solar'>('earth');
  const windows = activeTab === 'earth' ? earthWindows : solarWindows;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header and Tab Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Geometric Earth & Sunlight Windows
          </h3>
          <p className="text-xs text-slate-400">
            Contiguous intervals of positive angular clearance above lunar terrain
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('earth')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer font-medium ${
              activeTab === 'earth'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Earth DTE Links ({earthWindows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('solar')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer font-medium ${
              activeTab === 'solar'
                ? 'bg-amber-950 text-amber-300 border border-amber-800/80 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Sunlit Windows ({solarWindows.length})</span>
          </button>
        </div>
      </div>

      {/* Windows Table */}
      {windows.length === 0 ? (
        <div className="py-8 text-center text-slate-500 font-mono text-xs">
          No discrete {activeTab === 'earth' ? 'communication' : 'sunlight'} windows identified during this observation period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Pass #</th>
                <th className="py-2.5 px-3">Start Time (UTC)</th>
                <th className="py-2.5 px-3">End Time (UTC)</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Peak Elevation</th>
                <th className="py-2.5 px-3">Max Clearance</th>
                <th className="py-2.5 px-3">Samples</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {windows.map((win) => {
                return (
                  <tr
                    key={win.window_index}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-bold text-white">
                      <span className="flex items-center space-x-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            activeTab === 'earth'
                              ? 'bg-cyan-400'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span>#{win.window_index}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {win.start_time.replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {win.end_time.replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          activeTab === 'earth'
                            ? 'text-cyan-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {win.duration_hours.toFixed(2)} hrs
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {win.peak_elevation_deg > 0 ? `+${win.peak_elevation_deg.toFixed(2)}` : win.peak_elevation_deg.toFixed(2)}°
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 font-medium">
                      {win.max_clearance_deg > 0 ? `+${win.max_clearance_deg.toFixed(2)}` : win.max_clearance_deg.toFixed(2)}°
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {win.sample_count} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
