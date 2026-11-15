/**
 * Lunar South Polar Stereographic coordinate transformations.
 * Reference Datum: Moon (2015) Sphere with R = 1,737,400 meters.
 * Standard Parallel: 90°S (verified from the bundled DEM CRS).
 */

export const MOON_RADIUS_M = 1737400.0;

export const DEM_BOUNDS = {
  left: -304000.0,
  right: 304000.0,
  bottom: -304000.0,
  top: 304000.0,
};

export const DEM_EXTENT_M = 608000.0; // 304000 - (-304000)

/**
 * Convert selenodetic latitude and longitude to Polar Stereographic (X, Y) in meters.
 * @param lat Selenodetic latitude in degrees (-90.0 to -80.0)
 * @param lon Selenodetic longitude in degrees (-180.0 to 180.0 or 0.0 to 360.0)
 */
export function latLonToProj(lat: number, lon: number): { x: number; y: number } {
  const thetaRad = ((90.0 + lat) * Math.PI) / 180.0;
  const r = 2.0 * MOON_RADIUS_M * Math.tan(thetaRad / 2.0);
  const lonRad = (lon * Math.PI) / 180.0;
  const x = r * Math.sin(lonRad);
  const y = r * Math.cos(lonRad);
  return { x, y };
}

/**
 * Convert Polar Stereographic (X, Y) in meters to selenodetic latitude and longitude.
 * @param x Projected Easting in meters
 * @param y Projected Northing in meters
 */
export function projToLatLon(x: number, y: number): { latitude: number; longitude: number } {
  const r = Math.hypot(x, y);
  if (r === 0) {
    return { latitude: -90.0, longitude: 0.0 };
  }
  const lat = (2.0 * Math.atan(r / (2.0 * MOON_RADIUS_M)) * 180.0) / Math.PI - 90.0;
  let lon = (Math.atan2(x, y) * 180.0) / Math.PI;
  if (lon < -180.0) lon += 360.0;
  if (lon > 180.0) lon -= 360.0;
  return { latitude: lat, longitude: lon };
}

/**
 * Convert projected coordinates (X, Y) to normalized image pixel percentage [0, 100]%.
 * Note: Y is flipped because image top is Y_max (+304,000m) and bottom is Y_min (-304,000m).
 */
export function projToPixelPercent(x: number, y: number): { uPct: number; vPct: number } {
  const uPct = ((x - DEM_BOUNDS.left) / DEM_EXTENT_M) * 100.0;
  const vPct = ((DEM_BOUNDS.top - y) / DEM_EXTENT_M) * 100.0;
  return { uPct, vPct };
}

/**
 * Convert normalized image pixel percentage [0, 100]% to projected coordinates (X, Y) in meters.
 */
export function pixelPercentToProj(uPct: number, vPct: number): { x: number; y: number } {
  const x = DEM_BOUNDS.left + (uPct / 100.0) * DEM_EXTENT_M;
  const y = DEM_BOUNDS.top - (vPct / 100.0) * DEM_EXTENT_M;
  return { x, y };
}

/**
 * Check if projected coordinates (X, Y) lie within LOLA DEM extent.
 */
export function isWithinDEMBounds(x: number, y: number): boolean {
  return (
    x >= DEM_BOUNDS.left &&
    x <= DEM_BOUNDS.right &&
    y >= DEM_BOUNDS.bottom &&
    y <= DEM_BOUNDS.top
  );
}

/**
 * Check if selenodetic latitude is within LOLA South Pole coverage (-90° to -80°).
 */
export function isWithinLatitudeCoverage(lat: number): boolean {
  return lat >= -90.0 && lat <= -80.0;
}
