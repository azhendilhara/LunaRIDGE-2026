import React from 'react';
import {
  Radio,
  Sun,
  ShieldAlert,
  Clock,
  Activity,
  Layers,
  Zap,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TargetSummary, SiteInfo, TimeRangeSummary } from '../types/api';

interface MetricCardsProps {
  earthComm: TargetSummary;
  solarPower: TargetSummary;
  site: SiteInfo;
  timeRange: TimeRangeSummary;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  earthComm,
  solarPower,
  site,
  timeRange,
}) => {
  return (
    <div className="space-y-6">
      {/* Site Telemetry Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-slate-300">
        <div className="flex items-center space-x-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-white">Target Observer Site:</span>
          <span className="text-cyan-300">
            {site.latitude.toFixed(4)}°S, {site.longitude.toFixed(4)}°E
          </span>
        </div>
        <div className="flex items-center space-x-4 text-slate-400">
          <div>
            Ground Elev: <span className="text-white font-bold">{site.ground_elevation_m > 0 ? `+${site.ground_elevation_m.toFixed(1)}` : site.ground_elevation_m.toFixed(1)} m</span>
          </div>
          <div>
            Mast: <span className="text-cyan-400 font-bold">{site.observer_height_m.toFixed(1)} m</span>
          </div>
          <div>
            Altitude: <span className="text-white font-bold">{site.total_altitude_m > 0 ? `+${site.total_altitude_m.toFixed(1)}` : site.total_altitude_m.toFixed(1)} m</span>
          </div>
          <div className="hidden md:block">
            Span: <span className="text-sky-300 font-bold">{timeRange.elapsed_hours.toFixed(1)} hrs</span> ({timeRange.total_points} samples @ {timeRange.step_size})
          </div>
        </div>
      </div>

      {/* Earth Direct-to-Earth (DTE) Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center">
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Geometric Earth Visibility
              </h3>
              <p className="text-[11px] text-slate-400">
                Target-center clearance against LOLA terrain; no RF link budget is computed
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                earthComm.visibility_percentage > 70
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : earthComm.visibility_percentage > 30
                  ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                  : 'bg-rose-950/80 border-rose-800 text-rose-300'
              }`}
            >
              {earthComm.visibility_percentage.toFixed(1)}% Earth Visibility
            </span>
          </div>
        </div>

        {/* Earth Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Contact Hours */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Total Earth Visibility</span>
              <Eye className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {earthComm.total_visible_hours.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ {earthComm.total_interval_hours.toFixed(1)} hrs</span>
            </div>
            <div className="mt-2 text-[11px] text-cyan-300/90 font-mono">
              {earthComm.visibility_percentage.toFixed(1)}% of mission duration
            </div>
          </div>

          {/* Card 2: Longest Contact Window */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Longest Earth Visibility Window</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {earthComm.longest_window_hours.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono">hrs</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              {earthComm.window_count} discrete visible {earthComm.window_count === 1 ? 'window' : 'windows'}
            </div>
          </div>

          {/* Card 3: Longest Blackout */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-rose-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Longest Blackout</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono">
                {earthComm.longest_blackout_hours.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono">hrs</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              Total blocked: {earthComm.total_blocked_hours.toFixed(1)} hrs
            </div>
          </div>

          {/* Card 4: Finite Disk Limb Condition */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Full Disk vs Limb</span>
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl sm:text-2xl font-bold text-white font-mono">
                {earthComm.full_disk_visible_hours.toFixed(1)}h
              </span>
              <span className="text-[11px] text-amber-300 font-mono">
                +{earthComm.partial_limb_hours.toFixed(1)}h limb
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              Earth angular radius: ~0.95°
            </div>
          </div>
        </div>
      </div>

      {/* Solar Illumination Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center">
              <Sun className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Sunlight Availability
              </h3>
              <p className="text-[11px] text-slate-400">
                Sun-center visibility in the evaluated interval; no electrical power or permanent-shadow model
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                solarPower.visibility_percentage > 70
                  ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                  : solarPower.visibility_percentage > 30
                  ? 'bg-yellow-950/80 border-yellow-800 text-yellow-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {solarPower.visibility_percentage.toFixed(1)}% Sun Exposure
            </span>
          </div>
        </div>

        {/* Solar Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Sunlight Hours */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Total Sunlight</span>
              <Sun className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono">
                {solarPower.total_visible_hours.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ {solarPower.total_interval_hours.toFixed(1)} hrs</span>
            </div>
            <div className="mt-2 text-[11px] text-amber-300/80 font-mono">
              {solarPower.visibility_percentage.toFixed(1)}% illumination duty cycle
            </div>
          </div>

          {/* Card 2: Longest Continuous Sunlight */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Longest Sun Window</span>
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-yellow-300 font-mono">
                {solarPower.longest_window_hours.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono">hrs</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              {solarPower.window_count} discrete sunlight {solarPower.window_count === 1 ? 'window' : 'windows'}
            </div>
          </div>

          {/* Card 3: Longest Shadow / Night */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-600 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Longest Shadow</span>
              <EyeOff className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-300 font-mono">
                {solarPower.longest_blackout_hours.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono">hrs</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              Total shadow: {solarPower.total_blocked_hours.toFixed(1)} hrs
            </div>
          </div>

          {/* Card 4: Partial Solar Grazing */}
          <div className="bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-medium">Full Disk vs Grazing</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl sm:text-2xl font-bold text-white font-mono">
                {solarPower.full_disk_visible_hours.toFixed(1)}h
              </span>
              <span className="text-[11px] text-amber-300 font-mono">
                +{solarPower.partial_limb_hours.toFixed(1)}h grazing
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              Solar angular radius: ~0.267°
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
