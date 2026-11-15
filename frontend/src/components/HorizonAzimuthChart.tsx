import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { HorizonPoint, AnalysisPoint } from '../types/api';
import { fetchHorizonProfile } from '../services/api';
import { Mountain, Compass, Loader2, AlertCircle } from 'lucide-react';

interface HorizonAzimuthChartProps {
  latitude: number;
  longitude: number;
  observerHeightM: number;
  analysisPoints?: AnalysisPoint[];
  azimuthStepDeg?: number;
  maxDistanceKm?: number;
}

export const HorizonAzimuthChart: React.FC<HorizonAzimuthChartProps> = ({
  latitude,
  longitude,
  observerHeightM,
  analysisPoints = [],
  azimuthStepDeg = 1,
  maxDistanceKm = 50,
}) => {
  const [profile, setProfile] = useState<HorizonPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load horizon profile on coordinate changes
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchHorizonProfile({
          latitude,
          longitude,
          observer_height_m: observerHeightM,
          azimuth_step_deg: azimuthStepDeg,
          max_distance_km: maxDistanceKm,
        });
        if (isMounted) {
          setProfile(res.profile);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.detail || err?.message || 'Failed to calculate horizon profile');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, observerHeightM, azimuthStepDeg, maxDistanceKm]);

  // Merge profile with Earth/Sun trajectory points for visualization
  const chartData = profile.map((pt) => {
    const az = pt.azimuth_deg;
    // Find closest ephemeris point within 2 degrees azimuth
    const closestEarth = analysisPoints.find(
      (ap) => Math.abs(ap.earth.azimuth_deg - az) <= 2.0
    );
    const closestSun = analysisPoints.find(
      (ap) => Math.abs(ap.sun.azimuth_deg - az) <= 2.0
    );

    return {
      azimuth: az,
      horizonElev: parseFloat(pt.horizon_elevation_deg.toFixed(2)),
      obstacleDistKm: parseFloat((pt.obstacle_distance_m / 1000).toFixed(1)),
      earthElev: closestEarth ? parseFloat(closestEarth.earth.elevation_deg.toFixed(2)) : null,
      sunElev: closestSun ? parseFloat(closestSun.sun.elevation_deg.toFixed(2)) : null,
    };
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
            <Mountain className="w-4 h-4 text-cyan-400" />
            <span>360° Directional Terrain Horizon Profile (NASA LOLA)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Azimuth measured clockwise from selenodetic North (0° = N, 90° = E, 180° = S, 270° = W). Accounting for lunar curvature drop.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="flex items-center space-x-1.5 text-slate-300">
            <span className="w-3 h-2 bg-slate-700/80 border border-slate-500 rounded-sm" />
            <span>Terrain Skyline</span>
          </span>
          {analysisPoints.length > 0 && (
            <>
              <span className="flex items-center space-x-1.5 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Earth Track</span>
              </span>
              <span className="flex items-center space-x-1.5 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Sun Track</span>
              </span>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-2 text-slate-400 font-mono text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span>Ray-tracing LOLA South Pole GeoTIFF DEM (360°)...</span>
        </div>
      ) : error ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-2 text-rose-400 font-mono text-xs">
          <AlertCircle className="w-6 h-6" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#334155" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="azimuth"
                minTickGap={32}
                interval="preserveStartEnd"
                height={40}
                stroke="#64748b"
                fontSize={11}
                fontFamily="monospace"
                tickLine={false}
                unit="°"
                ticks={[0, 45, 90, 135, 180, 225, 270, 315, 360]}
                tickFormatter={(val) => {
                  if (val === 0 || val === 360) return `${val}° (N)`;
                  if (val === 90) return '90° (E)';
                  if (val === 180) return '180° (S)';
                  if (val === 270) return '270° (W)';
                  return `${val}°`;
                }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
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
                  value: '0° Tangent Plane',
                  fill: '#64748b',
                  fontSize: 10,
                  position: 'right',
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload;
                    return (
                      <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 shadow-xl space-y-1">
                        <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1">
                          Azimuth: {pt.azimuth}°
                        </div>
                        <div className="text-slate-300">
                          Obstruction Elevation:{' '}
                          <span className="text-white font-bold">
                            {pt.horizonElev > 0 ? `+${pt.horizonElev}` : pt.horizonElev}°
                          </span>
                        </div>
                        <div className="text-slate-400">
                          Limiting Ridge Dist: {pt.obstacleDistKm} km
                        </div>
                        {pt.earthElev !== null && (
                          <div className="text-cyan-300 font-bold">
                            Earth Elev at Az: {pt.earthElev}°
                          </div>
                        )}
                        {pt.sunElev !== null && (
                          <div className="text-amber-300 font-bold">
                            Sun Elev at Az: {pt.sunElev}°
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="horizonElev"
                name="Terrain Obstruction"
                stroke="#94a3b8"
                strokeWidth={1.8}
                fillOpacity={1}
                fill="url(#terrainGrad)"
              />
              {analysisPoints.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="earthElev"
                  name="Earth Target"
                  stroke="#00e5ff"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#00e5ff' }}
                  connectNulls={false}
                />
              )}
              {analysisPoints.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="sunElev"
                  name="Sun Target"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#fbbf24' }}
                  connectNulls={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
