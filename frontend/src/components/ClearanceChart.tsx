import { utcDate } from '../utils/scenario';
import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { AnalysisPoint } from '../types/api';
import { ShieldAlert, Radio, Sun } from 'lucide-react';

interface ClearanceChartProps {
  data: AnalysisPoint[];
}

export const ClearanceChart: React.FC<ClearanceChartProps> = ({ data }) => {
  const chartData = data.map((pt) => {
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
      earthClearance: pt.earth.clearance_deg,
      earthVisible: pt.earth.visible,
      sunClearance: pt.sun.clearance_deg,
      sunVisible: pt.sun.visible,
    };
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
            <span>Terrain Angular Clearance (Δθ = θ_target − θ_horizon)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Clearance margin above lunar terrain ridge lines. Values &gt; 0° indicate unblocked geometric line-of-sight.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="flex items-center space-x-1 text-cyan-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>Earth Margin</span>
          </span>
          <span className="flex items-center space-x-1 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Sun Margin</span>
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
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
            />
            <ReferenceLine
              y={0}
              stroke="#ef4444"
              strokeWidth={1.5}
              label={{
                value: '0° Line-of-Sight Threshold',
                fill: '#ef4444',
                fontSize: 10,
                position: 'insideBottomRight',
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const pt = payload[0].payload;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-2.5 font-mono text-xs text-slate-200 shadow-xl space-y-1">
                      <div className="text-[10px] text-slate-400">{pt.rawTime} UTC</div>
                      <div className="flex items-center justify-between space-x-4">
                        <span className="text-cyan-400 font-bold">Earth Clearance:</span>
                        <span className={`font-bold ${pt.earthClearance > 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                          {pt.earthClearance > 0 ? `+${Number(pt.earthClearance).toPrecision(6)}` : Number(pt.earthClearance).toPrecision(6)}°
                        </span>
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <span className="text-amber-400 font-bold">Sun Clearance:</span>
                        <span className={`font-bold ${pt.sunClearance > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                          {pt.sunClearance > 0 ? `+${Number(pt.sunClearance).toPrecision(6)}` : Number(pt.sunClearance).toPrecision(6)}°
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="earthClearance"
              name="Earth Clearance"
              stroke="#00e5ff"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="sunClearance"
              name="Sun Clearance"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
