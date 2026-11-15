import React from 'react';
import { Satellite, Compass, Sparkles, ArrowRight, Mountain, Radio, Sun } from 'lucide-react';
import { LUNAR_SOUTH_POLE_PRESETS, LunarSitePreset } from '../constants/presets';

interface EmptyStateProps {
  onSelectPreset: (preset: LunarSitePreset) => void;
  onRunAnalysis: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onSelectPreset,
  onRunAnalysis,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-8 backdrop-blur-sm">
      {/* Hero Badge & Icon */}
      <div className="max-w-xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>NASA Space Apps Mission Control Dashboard</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Evaluate Lunar Surface Line-of-Sight & Blackout Windows
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Configure observer selenodetic coordinates and observation timeframe in the Mission Configuration panel, then launch the simulation to compute real NASA ephemerides and LOLA DEM ray-tracing.
        </p>
      </div>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
            JPL Horizons Ephemerides
          </h4>
          <p className="text-[11px] text-slate-400">
            Accurate topocentric positions for Earth and Sun in the lunar body-fixed MEAN_ME frame.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400">
            <Mountain className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
            NASA LOLA 80m DEM
          </h4>
          <p className="text-[11px] text-slate-400">
            Sub-pixel South Pole terrain ray-tracing with lunar curvature drop correction.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <Sun className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
            Duration Conservation
          </h4>
          <p className="text-[11px] text-slate-400">
            Strict interval boundary root interpolation with zero duration distortion.
          </p>
        </div>
      </div>

      {/* Quick Launch Artemis Candidate Sites */}
      <div className="max-w-3xl mx-auto space-y-3 text-left">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span>Quick Select Artemis South Pole Exploration Sites:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LUNAR_SOUTH_POLE_PRESETS.slice(0, 4).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onSelectPreset(preset);
              }}
              className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-cyan-500/60 transition group text-left cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition">
                  {preset.name}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {preset.latitude.toFixed(2)}°S, {preset.longitude.toFixed(2)}°E
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
