import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  Crosshair,
  Compass,
  Layers,
  Mountain,
  Info,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  latLonToProj,
  projToLatLon,
  projToPixelPercent,
  pixelPercentToProj,
  isWithinLatitudeCoverage,
  MOON_RADIUS_M,
  DEM_BOUNDS,
} from '../utils/coordinates';
import { LUNAR_SOUTH_POLE_PRESETS, LunarSitePreset } from '../constants/presets';
import { fetchElevation } from '../services/api';

interface InteractiveLunarMapProps {
  selectedLat: number;
  selectedLon: number;
  onSelectSite: (lat: number, lon: number, name?: string) => void;
  className?: string;
}

export const InteractiveLunarMap: React.FC<InteractiveLunarMapProps> = ({
  selectedLat,
  selectedLon,
  onSelectSite,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapCircleRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover probe coordinates
  const [hoverCoords, setHoverCoords] = useState<{
    lat: number;
    lon: number;
    xKm: number;
    yKm: number;
    distPoleKm: number;
  } | null>(null);

  // Elevation probe at selected site
  const [selectedElevation, setSelectedElevation] = useState<number | null>(null);
  const [elevationLoading, setElevationLoading] = useState<boolean>(false);
  const [elevationError, setElevationError] = useState<string | null>(null);

  // Overlay layer toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPresets, setShowPresets] = useState<boolean>(true);
  const [hoveredPreset, setHoveredPreset] = useState<LunarSitePreset | null>(null);

  // Selected site projected coordinates and pixel percentages
  const selectedProj = latLonToProj(selectedLat, selectedLon);
  const selectedPixels = projToPixelPercent(selectedProj.x, selectedProj.y);

  // Fetch elevation whenever selected coordinates change
  useEffect(() => {
    let isMounted = true;
    if (!isWithinLatitudeCoverage(selectedLat)) {
      setSelectedElevation(null);
      return;
    }

    const loadElevation = async () => {
      setSelectedElevation(null);
      setElevationLoading(true);
      setElevationError(null);
      try {
        const res = await fetchElevation(selectedLat, selectedLon);
        if (isMounted) {
          setSelectedElevation(res.elevation_m);
        }
      } catch (err: any) {
        if (isMounted) {
          setElevationError(err?.detail || err?.message || 'Failed to query DEM');
        }
      } finally {
        if (isMounted) setElevationLoading(false);
      }
    };

    loadElevation();
    return () => {
      isMounted = false;
    };
  }, [selectedLat, selectedLon]);

  // Handle map zoom
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(6.0, Math.max(0.8, prev + delta)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Convert mouse event inside container to map coordinates
  const getMapCoordinatesFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Container center
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Undo pan and zoom
      // Point relative to map center in pixels:
      const mapX_px = (clientX - cx - pan.x) / zoom;
      const mapY_px = (clientY - cy - pan.y) / zoom;

      // Exact pixel size of circular lunar map
      const circleEl = mapCircleRef.current;
      const mapSize = circleEl ? circleEl.offsetWidth : 500;
      const uPct = (mapX_px / mapSize + 0.5) * 100.0;
      const vPct = (mapY_px / mapSize + 0.5) * 100.0;

      // Ignore points outside the circular lunar globe (distance from center > 50%)
      const distFromCenterPct = Math.hypot(uPct - 50.0, vPct - 50.0);
      if (distFromCenterPct > 50.0) {
        return null;
      }

      if (uPct < 0 || uPct > 100 || vPct < 0 || vPct > 100) {
        return null; // outside raster image
      }

      const proj = pixelPercentToProj(uPct, vPct);
      const geo = projToLatLon(proj.x, proj.y);
      const distPoleKm = Math.hypot(proj.x, proj.y) / 1000.0;

      return {
        lat: geo.latitude,
        lon: geo.longitude,
        xKm: proj.x / 1000.0,
        yKm: proj.y / 1000.0,
        distPoleKm,
      };
    },
    [pan, zoom]
  );

  // Mouse move handler for hover probe
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    const coords = getMapCoordinatesFromEvent(e);
    setHoverCoords(coords);
  };

  // Click handler to select new landing site
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent click if we were dragging
    const coords = getMapCoordinatesFromEvent(e);
    if (!coords) return;

    if (!isWithinLatitudeCoverage(coords.lat)) {
      return;
    }

    // Check if clicked near a preset
    const matchingPreset = LUNAR_SOUTH_POLE_PRESETS.find((p) => {
      const pProj = latLonToProj(p.latitude, p.longitude);
      const distM = Math.hypot(pProj.x - coords.xKm * 1000, pProj.y - coords.yKm * 1000);
      return distM < 8000; // within 8 km click radius
    });

    if (matchingPreset) {
      onSelectSite(matchingPreset.latitude, matchingPreset.longitude, matchingPreset.name);
    } else {
      onSelectSite(parseFloat(coords.lat.toFixed(4)), parseFloat(coords.lon.toFixed(4)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    handleZoom(delta);
  };

  // Calculate latitude circles for polar grid:
  // r = 2 * R * tan((90 + lat) / 2)
  const getLatitudeCircleRadiusPct = (lat: number) => {
    const thetaRad = ((90.0 + lat) * Math.PI) / 180.0;
    const rM = 2.0 * MOON_RADIUS_M * Math.tan(thetaRad / 2.0);
    // r relative to DEM radius (304,000m)
    return (rM / 304000.0) * 50.0; // radius percentage of map size (0 to 50%)
  };

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Interactive Lunar South Pole Map (NASA LOLA DEM)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
              South Polar Stereographic • R = 1,737.4 km
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Georeferenced shaded relief. Click anywhere within 80°S–90°S to position observer site and query DEM elevation.
          </p>
        </div>

        {/* Map Viewport Controls */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => handleZoom(0.3)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.3)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-1" />

          {/* Toggle Grid */}
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
              showGrid
                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle Polar Coordinates Grid"
          >
            Polar Grid
          </button>

          {/* Toggle Presets */}
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
              showPresets
                ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle Preset Landmarks"
          >
            Presets
          </button>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        className={`lunar-map-viewport relative w-full bg-[#030712] rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-crosshair'
        }`}
      >
        {/* Transformable Canvas Container */}
        <div
          ref={mapCircleRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="lunar-map-canvas relative rounded-full shadow-2xl"
        >
          {/* Shaded Relief Image */}
          <img
            src="/lunar_south_pole_dem.png"
            alt="NASA LOLA Lunar South Pole Shaded Relief"
            className="w-full h-full object-cover rounded-full pointer-events-none"
            draggable={false}
          />

          {/* Polar Grid Overlay */}
          {showGrid && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
            >
              {/* Concentric Latitude Rings */}
              {[-88, -85, -82, -80].map((lat) => {
                const rPct = getLatitudeCircleRadiusPct(lat);
                return (
                  <g key={lat}>
                    <circle
                      cx="50"
                      cy="50"
                      r={rPct}
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.22)"
                      strokeWidth="0.4"
                      strokeDasharray="1.5 1.5"
                    />
                    <text
                      x="50"
                      y={50 - rPct + 1.2}
                      textAnchor="middle"
                      fill="rgba(56, 189, 248, 0.6)"
                      fontSize="1.8"
                      fontFamily="monospace"
                    >
                      {Math.abs(lat)}°S
                    </text>
                  </g>
                );
              })}

              {/* Meridian Spokes */}
              {/* 0° (North/Up), 90° (East/Right), 180° (South/Down), 270° (West/Left) */}
              <line
                x1="50"
                y1="2"
                x2="50"
                y2="98"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="0.4"
              />
              <line
                x1="2"
                y1="50"
                x2="98"
                y2="50"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="0.4"
              />

              {/* Directional Labels */}
              <text x="50" y="3.5" textAnchor="middle" fill="#38bdf8" fontSize="2.2" fontFamily="monospace" fontWeight="bold">
                0° (N)
              </text>
              <text x="96" y="51" textAnchor="end" fill="#38bdf8" fontSize="2.2" fontFamily="monospace" fontWeight="bold">
                90°E
              </text>
              <text x="50" y="98.5" textAnchor="middle" fill="#38bdf8" fontSize="2.2" fontFamily="monospace" fontWeight="bold">
                180°
              </text>
              <text x="4" y="51" textAnchor="start" fill="#38bdf8" fontSize="2.2" fontFamily="monospace" fontWeight="bold">
                90°W
              </text>

              {/* South Pole Center Crosshair */}
              <circle cx="50" cy="50" r="0.8" fill="#00e5ff" />
              <text x="51.5" y="51.5" fill="#00e5ff" fontSize="2" fontFamily="monospace">
                90°S (Pole)
              </text>
            </svg>
          )}

          {/* Preset Landmark Pins */}
          {showPresets &&
            LUNAR_SOUTH_POLE_PRESETS.map((preset) => {
              const pProj = latLonToProj(preset.latitude, preset.longitude);
              const { uPct, vPct } = projToPixelPercent(pProj.x, pProj.y);
              const isSelected =
                Math.abs(preset.latitude - selectedLat) < 0.05 &&
                Math.abs(preset.longitude - selectedLon) < 0.05;

              return (
                <div
                  key={preset.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${preset.name}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelectSite(preset.latitude, preset.longitude, preset.name); } }}
                  style={{
                    left: `${uPct}%`,
                    top: `${vPct}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseEnter={() => setHoveredPreset(preset)}
                  onMouseLeave={() => setHoveredPreset(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSite(preset.latitude, preset.longitude, preset.name);
                  }}
                  className="absolute cursor-pointer group z-20"
                >
                  <div
                    className={`w-3 h-3 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-cyan-400 border-white scale-125 shadow-lg shadow-cyan-400'
                        : 'bg-amber-400 border-amber-900 group-hover:scale-125'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-950" />
                  </div>
                </div>
              );
            })}

          {/* Active Selected Landing Site Marker */}
          {isWithinLatitudeCoverage(selectedLat) && (
            <div
              style={{
                left: `${selectedPixels.uPct}%`,
                top: `${selectedPixels.vPct}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-none z-30 flex items-center justify-center"
            >
              <div className="relative">
                <span className="w-6 h-6 rounded-full border-2 border-cyan-400 animate-ping absolute -top-1 -left-1" />
                <div className="w-4 h-4 rounded-full bg-cyan-500/80 border-2 border-white flex items-center justify-center shadow-lg shadow-cyan-500/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hovered Preset Tooltip Banner */}
        {hoveredPreset && (
          <div className="absolute top-4 left-4 bg-slate-950/95 border border-amber-600/80 rounded-xl p-3 max-w-xs shadow-2xl font-mono text-xs text-slate-200 z-40 pointer-events-none">
            <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-800 pb-1">
              <span>{hoveredPreset.name}</span>
            </div>
            <div className="text-[11px] text-cyan-300 mt-1">
              {hoveredPreset.latitude.toFixed(2)}°S, {hoveredPreset.longitude.toFixed(2)}°E
            </div>
            <p className="text-[10px] text-slate-300 mt-1 leading-tight font-sans">
              {hoveredPreset.description}
            </p>
            <div className="text-[10px] text-amber-400/90 mt-1.5">
              • {hoveredPreset.category}
            </div>
          </div>
        )}

        {/* Floating Real-Time Hover Coordinates HUD */}
        <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-800/90 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-300 pointer-events-none flex items-center space-x-3 shadow-lg backdrop-blur-md">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          {hoverCoords ? (
            <div className="flex items-center space-x-3">
              <span>
                Lat: <span className="text-white font-bold">{hoverCoords.lat.toFixed(3)}°S</span>
              </span>
              <span>
                Lon: <span className="text-white font-bold">{hoverCoords.lon.toFixed(3)}°E</span>
              </span>
              <span className="text-slate-400 hidden sm:inline">
                Dist Pole: {hoverCoords.distPoleKm.toFixed(1)} km
              </span>
            </div>
          ) : (
            <span className="text-slate-500">Hover over lunar map to probe coordinates</span>
          )}
        </div>

        {/* Compass Cardinal Watermark */}
        <div className="absolute top-3 right-3 bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 text-center pointer-events-none font-mono text-[10px] text-slate-400">
          <div className="text-cyan-400 font-bold">N (0°)</div>
          <div className="text-[9px] text-slate-500">Toward Earth Mean Meridian</div>
        </div>
      </div>

      {/* Selected Site Information Telemetry Strip */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-white uppercase">Selected Site Coordinates:</span>
          <span className="text-cyan-300 font-bold">
            {Math.abs(selectedLat).toFixed(4)}°S, {selectedLon.toFixed(4)}°E
          </span>
          <span className="text-slate-400 text-[11px]">
            (X: {(selectedProj.x / 1000).toFixed(1)} km, Y: {(selectedProj.y / 1000).toFixed(1)} km)
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Mountain className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">NASA LOLA Ground Elevation:</span>
            {elevationLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : selectedElevation !== null ? (
              <span className="text-white font-bold">
                {selectedElevation > 0 ? `+${selectedElevation.toFixed(1)}` : selectedElevation.toFixed(1)} m
              </span>
            ) : elevationError ? (
              <span className="text-rose-400">{elevationError}</span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Elevation Color Scale Legend */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
        <span>Deep Crater Basins (-7,200m)</span>
        <div className="h-2.5 w-64 rounded-full bg-gradient-to-r from-[#060c18] via-[#374458] via-[#0e8cac] to-[#f5faff] border border-slate-700 mx-2" />
        <span>Massifs & Summits (+7,000m)</span>
      </div>
    </div>
  );
};
