import {usableSummary} from './ScientificResults';
import { utcDate } from '../utils/scenario';
import React from 'react';
import { TargetSummary, TimeRangeSummary } from '../types/api';
import { Radio, Sun, CheckCircle, XCircle } from 'lucide-react';

interface TimelineBarProps {
  earthComm: TargetSummary;
  solarPower: TargetSummary;
  timeRange: TimeRangeSummary;
  compact?: boolean;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  earthComm,
  solarPower,
  timeRange,
  compact=false,
}) => {
  if (!usableSummary(earthComm) || !usableSummary(solarPower) || !timeRange || !Number.isFinite(timeRange.elapsed_hours) || timeRange.elapsed_hours <= 0) return <p role="status">Timeline unavailable: complete visibility durations and evaluated UTC bounds are required. Missing data are not zero visibility.</p>;
  const totalHours = timeRange.elapsed_hours;

  // Calculate pixel positioning percentage strictly aligned to mission UTC timeline
  const getWindowTrackStyle = (startTimeStr: string, durationHours: number) => {
    const missionStartMs = utcDate(timeRange.start_time).getTime();
    const winStartMs = utcDate(startTimeStr).getTime();
    const offsetHours = Math.max(0, (winStartMs - missionStartMs) / 3600000.0);
    const leftPct = Math.max(0, Math.min(100, (offsetHours / totalHours) * 100.0));
    const widthPct = Math.max(0, Math.min(100 - leftPct, (durationHours / totalHours) * 100.0));
    return {
      left: `${leftPct}%`,
      width: `${widthPct}%`,
    };
  };

  return (
    <div className="timeline-readable bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Mission Availability Timelines
          </h3>
          <p className="text-xs text-slate-400">
            {compact?'Target-center visibility across your evaluated window':`Geometric Earth visibility and sunlight intervals across ${totalHours.toFixed(1)} mission hours`}
          </p>
        </div>
        <div hidden={compact} className="flex items-center space-x-4 text-xs font-mono text-slate-400">
          <span>{timeRange.start_time.replace('T', ' ')} UTC</span>
          <span>→</span>
          <span>{timeRange.stop_time.replace('T', ' ')} UTC</span>
        </div>
      </div>

      {/* Earth Contact Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-cyan-300 font-mono flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Geometric Earth Visibility Schedule</span>
          </span>
          <span className="font-mono text-slate-400">
            {earthComm.window_count} {earthComm.window_count === 1 ? 'window' : 'windows'} {!compact && `(${earthComm.total_visible_hours.toFixed(1)}h Earth visible / ${earthComm.total_blocked_hours.toFixed(1)}h blackout)`}
          </span>
        </div>

        {/* Timeline Bar */}
        <div className="relative h-7 w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
          {earthComm.windows.length === 0 ? (
            <div className="w-full h-full bg-rose-950/70 text-rose-300 flex items-center justify-center text-xs font-mono">
              CONTINUOUS BLACKOUT (0% Direct Earth Line-of-Sight)
            </div>
          ) : earthComm.total_blocked_hours === 0 ? (
            <div className="w-full h-full bg-gradient-to-r from-cyan-600 to-sky-500 text-slate-950 font-bold flex items-center justify-center text-xs font-mono tracking-wider">
              EARTH VISIBLE THROUGHOUT EVALUATED INTERVAL ({earthComm.total_visible_hours.toFixed(1)} HRS)
            </div>
          ) : (
            // Render windows strictly at their UTC time positions
            earthComm.windows.map((win) => {
              const style = getWindowTrackStyle(win.start_time, win.duration_hours);
              return (
                <div
                  key={win.window_index}
                  tabIndex={0}
                  aria-label={`Window ${win.window_index}: ${win.start_time} to ${win.end_time}, ${win.duration_hours} hours`}
                  style={{
                    ...style,
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-sky-400 text-slate-950 font-bold flex items-center justify-center text-xs font-mono hover:brightness-110 transition cursor-help timeline-window px-1 truncate border-r border-slate-950"
                  title={`Pass #${win.window_index}: ${win.duration_hours.toFixed(1)}h (${win.start_time.substring(11, 16)} to ${win.end_time.substring(11, 16)} UTC) | Peak Elev: +${win.peak_elevation_deg.toFixed(1)}°`}
                >
                  {compact ? (parseFloat(style.width)>8?`#${win.window_index}`:'') : win.duration_hours > 2.0 ? `Pass #${win.window_index} (${win.duration_hours.toFixed(1)}h)` : ''}
                </div>
              );
            })
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>Start: {timeRange.start_time.substring(5, 16).replace('T', ' ')}</span>
          <span className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-cyan-400" />
              <span className="text-slate-400">Earth Visibility</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-slate-950 border border-slate-700" />
              <span className="text-slate-500">Terrain Blackout</span>
            </span>
          </span>
          <span>End: {timeRange.stop_time.substring(5, 16).replace('T', ' ')}</span>
        </div>
      </div>

      <DiskStateLegend summary={earthComm} name="Earth" />
      {/* Solar Illumination Timeline */}
      <div className="space-y-2 pt-2 border-t border-slate-800/60">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-300 font-mono flex items-center space-x-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Sunlight Availability Schedule</span>
          </span>
          <span className="font-mono text-slate-400">
            {solarPower.window_count} {solarPower.window_count === 1 ? 'window' : 'windows'} {!compact && `(${solarPower.total_visible_hours.toFixed(1)}h illuminated / ${solarPower.total_blocked_hours.toFixed(1)}h shadow)`}
          </span>
        </div>

        {/* Timeline Bar */}
        <div className="relative h-7 w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
          {solarPower.windows.length === 0 ? (
            <div className="w-full h-full bg-slate-900 text-slate-400 flex items-center justify-center text-xs font-mono">
              NO SUNLIGHT IN EVALUATED INTERVAL
            </div>
          ) : solarPower.total_blocked_hours === 0 ? (
            <div className="w-full h-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold flex items-center justify-center text-xs font-mono tracking-wider">
              CONTINUOUS SOLAR ILLUMINATION ({solarPower.total_visible_hours.toFixed(1)} HRS)
            </div>
          ) : (
            solarPower.windows.map((win) => {
              const style = getWindowTrackStyle(win.start_time, win.duration_hours);
              return (
                <div
                  key={win.window_index}
                  tabIndex={0}
                  aria-label={`Window ${win.window_index}: ${win.start_time} to ${win.end_time}, ${win.duration_hours} hours`}
                  style={{
                    ...style,
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                  }}
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold flex items-center justify-center text-xs font-mono hover:brightness-110 transition cursor-help timeline-window px-1 truncate border-r border-slate-950"
                  title={`Sun Window #${win.window_index}: ${win.duration_hours.toFixed(1)}h (${win.start_time.substring(11, 16)} to ${win.end_time.substring(11, 16)} UTC) | Peak Elev: +${win.peak_elevation_deg.toFixed(1)}°`}
                >
                  {compact ? (parseFloat(style.width)>8?`#${win.window_index}`:'') : win.duration_hours > 2.0 ? `Sun #${win.window_index} (${win.duration_hours.toFixed(1)}h)` : ''}
                </div>
              );
            })
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>Start: {timeRange.start_time.substring(5, 16).replace('T', ' ')}</span>
          <span className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-amber-400" />
              <span className="text-slate-400">Sunlit Window</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-slate-950 border border-slate-700" />
              <span className="text-slate-500">Shadow / Night</span>
            </span>
          </span>
          <span>End: {timeRange.stop_time.substring(5, 16).replace('T', ' ')}</span>
        </div>
      </div>
      <DiskStateLegend summary={solarPower} name="Sun" />
    </div>
  );
};

function DiskStateLegend({summary:s,name}:{summary:TargetSummary;name:string}) {
 const valid=[s.full_disk_visible_hours,s.partial_limb_hours,s.fully_blocked_hours].every(n=>typeof n==='number' && Number.isFinite(n));
 return <details className="text-sm"><summary>{name}: understand whole-disk and partial-limb intervals</summary>
 {valid ? <div className="disk-state-legend"><span>Whole disk visible: {s.full_disk_visible_hours.toFixed(1)} h</span><span>Partial limb: {s.partial_limb_hours.toFixed(1)} h</span><span>Whole disk blocked: {s.fully_blocked_hours.toFixed(1)} h</span></div> : <p>Disk-state duration diagnostics are unavailable.</p>}
 <p className="text-slate-400 mt-2">These are duration totals, not a chronological track. A partially exposed disk can have its center either visible or blocked, so partial-limb time is not extra center-visible time. The colored timeline above shows target-center visibility; its dark segments show center blockage. Disk states use approximate mean angular radii and a single-direction skyline, not integrated illumination.</p></details>;
}
