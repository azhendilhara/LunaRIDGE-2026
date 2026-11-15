import { utcDate, LatestRequest } from '../utils/scenario';
import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  Compass,
  Sliders,
  ChevronDown,
  Mountain,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { AnalysisRequest } from '../types/api';
import { LUNAR_SOUTH_POLE_PRESETS } from '../constants/presets';
import { fetchElevation } from '../services/api';

interface ControlsPanelProps {
  request: AnalysisRequest;
  onChange: (req: AnalysisRequest) => void;
  onRunAnalysis: () => void;
  isLoading: boolean;
  onOpenMap?: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  request,
  onChange,
  onRunAnalysis,
  isLoading,
  onOpenMap,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('shackleton-rim');
  const [elevationPreview, setElevationPreview] = useState<number | null>(null);
  const [fetchingElevation, setFetchingElevation] = useState<boolean>(false);
  const [elevationError, setElevationError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const elevationGate = useRef(new LatestRequest());
  useEffect(() => {
    elevationGate.current.invalidate();
    setElevationPreview(null); setElevationError(null); setFetchingElevation(false);
    return () => elevationGate.current.invalidate();
  }, [request.latitude, request.longitude]);

  // Update a single field
  const updateField = <K extends keyof AnalysisRequest>(
    key: K,
    val: AnalysisRequest[K]
  ) => {
    onChange({ ...request, [key]: val });
  };

  // Match preset dynamically based on coordinates
  const matchingPreset = LUNAR_SOUTH_POLE_PRESETS.find(
    (p) =>
      Math.abs(p.latitude - request.latitude) < 0.05 &&
      Math.abs(p.longitude - request.longitude) < 0.05
  );
  const currentPresetValue = matchingPreset ? matchingPreset.id : 'custom';

  // Handle preset change
  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    if (presetId === 'custom') return;
    const found = LUNAR_SOUTH_POLE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      onChange({
        ...request,
        latitude: found.latitude,
        longitude: found.longitude,
      });
      setElevationPreview(null);
    }
  };

  // Quick duration helper
  const setQuickDuration = (hours: number) => {
    try {
      const start = utcDate(request.start_time);
      if (isNaN(start.getTime())) return;
      const stop = new Date(start.getTime() + hours * 3600 * 1000);
      const stopStr = stop.toISOString().substring(0, 19);
      updateField('stop_time', stopStr);
    } catch (e) {
      console.error(e);
    }
  };

  // Query DEM elevation for selected coordinates
  const handleQueryElevation = async () => {
    const id = elevationGate.current.begin();
    setFetchingElevation(true);
    setElevationError(null);
    try {
      const res = await fetchElevation(request.latitude, request.longitude);
      if (elevationGate.current.isCurrent(id)) setElevationPreview(res.elevation_m);
    } catch (err: any) {
      if (elevationGate.current.isCurrent(id)) setElevationError(err?.detail || err?.message || 'Failed to query DEM');
    } finally {
      if (elevationGate.current.isCurrent(id)) setFetchingElevation(false);
    }
  };

  // Check latitude validity
  const isLatValid = request.latitude >= -90.0 && request.latitude <= -80.0;
  const isLonValid = request.longitude >= -180.0 && request.longitude <= 360.0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-6">
      {/* Panel Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white tracking-wide uppercase font-mono">
            Mission Configuration
          </h2>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
          LOLA 80S Coverage
        </span>
      </div>

      {/* Preset Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Lunar South Pole Presets</span>
          </span>
        </label>
        <div className="relative">
          <select
            value={currentPresetValue}
            onChange={handleSelectPreset}
            className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 appearance-none pr-8 cursor-pointer font-medium"
          >
            {LUNAR_SOUTH_POLE_PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 py-1">
                {p.name} ({p.latitude.toFixed(2)}°, {p.longitude.toFixed(2)}°)
              </option>
            ))}
            {currentPresetValue === 'custom' && (
              <option value="custom" className="bg-slate-900 py-1 text-cyan-300">
                Custom Coordinates ({request.latitude.toFixed(2)}°, {request.longitude.toFixed(2)}°)
              </option>
            )}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Coordinates Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Landing Site Coordinates
          </span>
          {onOpenMap && (
            <button
              type="button"
              onClick={onOpenMap}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer font-mono"
            >
              <MapPin className="w-3 h-3" />
              <span>Interactive Map</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Latitude */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Latitude (Selenodetic)</span>
              <span className="text-[10px] text-cyan-400 font-mono">-90° to -80°</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="-90.0"
                max="-80.0"
                value={request.latitude}
                onChange={(e) => updateField('latitude', parseFloat(e.target.value) || -89.9)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none ${
                  isLatValid
                    ? 'border-slate-700 focus:border-cyan-500'
                    : 'border-rose-500 text-rose-300'
                }`}
              />
              <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">°S</span>
            </div>
          </div>

          {/* Longitude */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Longitude</span>
              <span className="text-[10px] text-cyan-400 font-mono">East Positive</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="-180.0"
                max="360.0"
                value={request.longitude}
                onChange={(e) => updateField('longitude', parseFloat(e.target.value) || 0.0)}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none ${
                  isLonValid
                    ? 'border-slate-700 focus:border-cyan-500'
                    : 'border-rose-500 text-rose-300'
                }`}
              />
              <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">°E</span>
            </div>
          </div>
        </div>

        {/* DEM Elevation preview badge */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-400">
            <Mountain className="w-3.5 h-3.5 text-cyan-400" />
            <span>LOLA Ground Elevation:</span>
          </div>
          <div className="flex items-center space-x-2">
            {elevationPreview !== null ? (
              <span className="text-cyan-300 font-bold">
                {elevationPreview > 0 ? `+${elevationPreview.toFixed(1)}` : elevationPreview.toFixed(1)} m
              </span>
            ) : (
              <button
                type="button"
                onClick={handleQueryElevation}
                disabled={fetchingElevation}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer disabled:opacity-50"
              >
                {fetchingElevation ? 'Reading GeoTIFF...' : 'Lookup in DEM'}
              </button>
            )}
          </div>
        </div>
        {elevationError && (
          <p className="text-[11px] text-rose-400 flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3" />
            <span>{elevationError}</span>
          </p>
        )}
      </div>

      {/* Date & Time Range */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>UTC Mission Observation Window</span>
          </label>
        </div>

        <div className="space-y-2">
          {/* Start Time */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Start Time (UTC)</span>
            <input
              type="text"
              value={request.start_time}
              onChange={(e) => updateField('start_time', e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SS"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Stop Time */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Stop Time (UTC)</span>
            <input
              type="text"
              value={request.stop_time}
              onChange={(e) => updateField('stop_time', e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SS"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Quick Span Presets */}
        <div className="flex items-center space-x-2 pt-1">
          <span className="text-[11px] text-slate-500">Quick Span:</span>
          {[
            { label: '+24h', hours: 24 },
            { label: '+36h', hours: 36 },
            { label: '+48h', hours: 48 },
            { label: '+7d', hours: 168 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setQuickDuration(item.hours)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 hover:text-white transition cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Observer Parameters */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <div className="grid grid-cols-2 gap-3">
          {/* Step Size */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 flex items-center space-x-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Time Step</span>
            </label>
            <select
              value={request.step_size || '1h'}
              onChange={(e) => updateField('step_size', e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="15m">15m (High Res)</option>
              <option value="30m">30m</option>
              <option value="1h">1h (Standard)</option>
              <option value="2h">2h</option>
              <option value="4h">4h (Fast)</option>
            </select>
          </div>

          {/* Observer Mast Height */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Mast Height</span>
              <span className="text-[10px] text-cyan-400 font-mono">
                {request.observer_height_m?.toFixed(1) || 2.0} m
              </span>
            </label>
            <input
              data-scenario-field="mast"
              aria-label="Observer mast height (m)"
              type="number"
              step="0.5"
              min="0.0"
              max="50.0"
              value={request.observer_height_m ?? 2.0}
              onChange={(e) =>
                updateField('observer_height_m', parseFloat(e.target.value) || 0.0)
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Slider for mast height */}
        <input
          type="range"
          min="0"
          max="30"
          step="0.5"
          value={request.observer_height_m ?? 2.0}
          onChange={(e) =>
            updateField('observer_height_m', parseFloat(e.target.value))
          }
          className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0m (Ground level)</span>
          <span>2m (Rover antenna)</span>
          <span>10m+ (Lander mast)</span>
        </div>
      </div>

      {/* Advanced Toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer transition"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              showAdvanced ? 'rotate-180' : ''
            }`}
          />
          <span>Advanced Terrain Profiler Settings</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Horizon Ray Radius:</span>
                <span className="font-mono text-cyan-400">
                  {request.horizon_max_distance_km || 50} km
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={request.horizon_max_distance_km || 50}
                onChange={(e) =>
                  updateField(
                    'horizon_max_distance_km',
                    parseFloat(e.target.value)
                  )
                }
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Azimuth Sampling Step:</span>
                <span className="font-mono text-cyan-400">
                  {request.horizon_azimuth_step_deg || 1.0}°
                </span>
              </div>
              <select
                value={request.horizon_azimuth_step_deg || 1.0}
                onChange={(e) =>
                  updateField(
                    'horizon_azimuth_step_deg',
                    parseFloat(e.target.value)
                  )
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-300"
              >
                <option value="0.5">0.5° (720 high-res rays)</option>
                <option value="1.0">1.0° (360 rays — Standard)</option>
                <option value="2.0">2.0° (180 rays — Faster)</option>
                <option value="5.0">5.0° (72 rays — Quick Preview)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Run Analysis Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={isLoading || !isLatValid || !isLonValid}
          className="w-full py-3.5 px-4 rounded-xl font-bold tracking-wider uppercase text-sm flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-cyan-500/25 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-cyan-400/40 active:scale-[0.99]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              <span>Computing Horizons & LOLA...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Visibility Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
