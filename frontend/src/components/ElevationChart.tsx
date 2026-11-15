import { utcDate } from '../utils/scenario';
import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { AnalysisPoint } from '../types/api';
import { Eye, Radio, Sun, Mountain } from 'lucide-react';

interface ElevationChartProps {
  data: AnalysisPoint[];
}

export const ElevationChart: React.FC<ElevationChartProps> = ({ data }) => {
  const [showEarth, setShowEarth] = useState<boolean>(true);
  const [showSun, setShowSun] = useState<boolean>(true);
  const [showHorizons, setShowHorizons] = useState<boolean>(true);

  // Format data for Recharts
  const chartData = data.map((pt) => {
    // Format timestamp: "11-06 04:00"
    const d = utcDate(pt.timestamp);
    const timeLabel = isNaN(d.getTime())
      ? pt.timestamp.substring(5, 16).replace('T', ' ')
      : `${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d
          .getUTCDate()
          .toString()
          .padStart(2, '0')} ${d
          .getUTCHours()
          .toString()
          .padStart(2, '0')}:${d
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')}`;

    return {
      rawTime: pt.timestamp,
      timeMs: d.getTime(),
      time: timeLabel,
      earthElev: pt.earth.elevation_deg,
      earthHorizon: pt.earth.horizon_elevation_deg,
      earthClearance: pt.earth.clearance_deg,
      earthVisible: pt.earth.visible,
      earthStatus: pt.earth.los_status,
      earthDisk: pt.earth.disk_occlusion,
      earthAzimuth: parseFloat(pt.earth.azimuth_deg.toFixed(1)),

      sunElev: pt.sun.elevation_deg,
      sunHorizon: pt.sun.horizon_elevation_deg,
      sunClearance: pt.sun.clearance_deg,
      sunVisible: pt.sun.visible,
      sunStatus: pt.sun.los_status,
      sunDisk: pt.sun.disk_occlusion,
      sunAzimuth: parseFloat(pt.sun.azimuth_deg.toFixed(1)),
    };
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
            <span>Elevation Angles & Terrain Horizon vs UTC Time</span>
          </h3>
          <p className="text-xs text-slate-400">
            Topocentric elevation above local lunar tangent plane (0°). Visible when target elevation exceeds terrain horizon.
          </p>
        </div>

        {/* Visibility Toggles */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setShowEarth(!showEarth)}
            className={`px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition cursor-pointer ${
              showEarth
                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Earth</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSun(!showSun)}
            className={`px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition cursor-pointer ${
              showSun
                ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Sun</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHorizons(!showHorizons)}
            className={`px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition cursor-pointer ${
              showHorizons
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <Mountain className="w-3.5 h-3.5 text-slate-400" />
            <span>Terrain Horizon</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 10, right: 40, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="timeMs"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              minTickGap={56}
              padding={{left:12,right:24}}
              interval="preserveStartEnd"
              tickFormatter={(value) => new Date(value).toISOString().slice(5,16).replace('T',' ')}
              height={44}
              label={{value:'UTC · month-day hour:minute',position:'insideBottom',fill:'#94a3b8',fontSize:11}}
              stroke="#94a3b8"
              fontSize={12}
              fontFamily="monospace"
              tickLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              fontFamily="monospace"
              tickLine={false}
              unit="°"
              domain={['auto', 'auto']}
            />
            <ReferenceLine
              y={0}
              stroke="#475569"
              strokeDasharray="4 4"
              label={{
                value: '0° Geometric Horizon',
                fill: '#64748b',
                fontSize: 10,
                position: 'right',
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Earth Traces */}
            {showEarth && (
              <Line
                type="monotone"
                dataKey="earthElev"
                name="Earth Elevation"
                stroke="#00e5ff"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#00e5ff', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#38bdf8' }}
              />
            )}
            {showEarth && showHorizons && (
              <Line
                type="monotone"
                dataKey="earthHorizon"
                name="Earth Terrain Horizon"
                stroke="#0284c7"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            )}

            {/* Sun Traces */}
            {showSun && (
              <Line
                type="monotone"
                dataKey="sunElev"
                name="Sun Elevation"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#fbbf24', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#f59e0b' }}
              />
            )}
            {showSun && showHorizons && (
              <Line
                type="monotone"
                dataKey="sunHorizon"
                name="Sun Terrain Horizon"
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Custom Telemetry Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const pt = payload[0].payload;
    return (
      <div className="bg-slate-950/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md font-mono text-xs text-slate-200 space-y-2 min-w-[240px]">
        <div className="text-[11px] text-cyan-400 font-semibold border-b border-slate-800 pb-1">
          {pt.rawTime} UTC
        </div>

        {/* Earth Telemetry */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-cyan-300 font-bold">
            <span className="flex items-center space-x-1">
              <Radio className="w-3 h-3 text-cyan-400" />
              <span>Earth Target</span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                pt.earthVisible
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              {pt.earthVisible ? 'VISIBLE' : 'BLOCKED'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 text-[11px] text-slate-300">
            <div>Elev: <span className="text-white font-bold">{Number(pt.earthElev).toPrecision(6)}°</span></div>
            <div>Az: <span className="text-white">{pt.earthAzimuth}°</span></div>
            <div>Terrain: <span className="text-slate-400">{Number(pt.earthHorizon).toPrecision(6)}°</span></div>
            <div>
              Clearance:{' '}
              <span
                className={`font-bold ${
                  pt.earthClearance > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {pt.earthClearance > 0 ? `+${Number(pt.earthClearance).toPrecision(6)}` : Number(pt.earthClearance).toPrecision(6)}°
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300">Earth disk: {pt.earthDisk?.replaceAll('_', ' ').toLowerCase()}</p>
<p className="text-xs text-slate-300">Sun disk: {pt.sunDisk?.replaceAll('_', ' ').toLowerCase()}</p>
        {/* Sun Telemetry */}
        <div className="space-y-1 pt-1.5 border-t border-slate-800">
          <div className="flex items-center justify-between text-amber-300 font-bold">
            <span className="flex items-center space-x-1">
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Sun Target</span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                pt.sunVisible
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-slate-900 text-slate-400 border border-slate-700'
              }`}
            >
              {pt.sunVisible ? 'CENTER VISIBLE' : 'CENTER BLOCKED'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 text-[11px] text-slate-300">
            <div>Elev: <span className="text-white font-bold">{Number(pt.sunElev).toPrecision(6)}°</span></div>
            <div>Az: <span className="text-white">{pt.sunAzimuth}°</span></div>
            <div>Terrain: <span className="text-slate-400">{Number(pt.sunHorizon).toPrecision(6)}°</span></div>
            <div>
              Clearance:{' '}
              <span
                className={`font-bold ${
                  pt.sunClearance > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {pt.sunClearance > 0 ? `+${Number(pt.sunClearance).toPrecision(6)}` : Number(pt.sunClearance).toPrecision(6)}°
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};
