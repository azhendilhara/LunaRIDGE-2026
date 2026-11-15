"""Generate high-resolution shaded relief preview from NASA LOLA South Pole GeoTIFF."""

import math
import os
import rasterio
from rasterio.enums import Resampling
import numpy as np
from PIL import Image

DEM_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "lunar_dem", "LDEM_80S_80MPP_ADJ.TIF"))
OUTPUT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "lunar_south_pole_dem.png"))

def generate_lunar_map(size=1024):
    print(f"Opening DEM at {DEM_PATH}...")
    if not os.path.exists(DEM_PATH):
        raise FileNotFoundError(f"DEM not found at {DEM_PATH}")

    with rasterio.open(DEM_PATH) as src:
        bounds = src.bounds
        print(f"DEM bounds: {bounds}")
        print(f"Resampling to {size}x{size}...")
        dem = src.read(1, out_shape=(size, size), resampling=Resampling.bilinear)
    
    # Calculate cell size in downsampled grid
    dx = (bounds.right - bounds.left) / size
    dy = (bounds.top - bounds.bottom) / size
    
    # Mask invalid/NoData
    valid_mask = ~np.isnan(dem)
    min_elev = np.nanmin(dem)
    max_elev = np.nanmax(dem)
    print(f"Elevation range: {min_elev:.1f} m to {max_elev:.1f} m")

    # Replace NaNs with min_elev for gradient computation
    elev_clean = np.where(valid_mask, dem, min_elev)

    # Compute spatial gradients (dz/dy, dz/dx)
    gy, gx = np.gradient(elev_clean, dy, dx)

    # Hillshade illumination: Sun from NW (azimuth 315°), altitude 45°
    sun_az = math.radians(315.0)
    sun_alt = math.radians(45.0)

    # Slope and aspect
    slope = np.arctan(np.sqrt(gx**2 + gy**2))
    aspect = np.arctan2(gy, -gx)

    hillshade = np.sin(sun_alt) * np.cos(slope) + np.cos(sun_alt) * np.sin(slope) * np.cos(sun_az - aspect)
    hillshade = np.clip(hillshade, 0.0, 1.0)

    # Normalized elevation [0, 1]
    norm_elev = np.clip((dem - min_elev) / (max_elev - min_elev), 0.0, 1.0)
    norm_elev = np.where(valid_mask, norm_elev, 0.0)

    # Color palette (Deep Navy -> Slate Grey -> Cyan -> White)
    # Define color control points
    # 0.0 (deep crater floor ~ -7200m): (8, 14, 28) - Deep space navy
    # 0.35 (medium floor ~ -2200m): (24, 38, 62) - Slate navy
    # 0.55 (nominal zero ~ 0m): (51, 65, 85) - Lunar regolith slate
    # 0.75 (high ridge ~ +3500m): (34, 139, 172) - Cyan-highlighted peak
    # 0.90 (summit ~ +5500m): (94, 215, 235) - Bright cyan
    # 1.0 (highest massif ~ +7000m): (240, 248, 255) - White peak
    
    rgb = np.zeros((size, size, 3), dtype=np.float32)

    # Linear interpolation across elevation
    c0 = np.array([6, 12, 24])     # deep PSR
    c1 = np.array([20, 32, 54])    # low basin
    c2 = np.array([55, 68, 88])    # nominal terrain
    c3 = np.array([14, 140, 175])  # ridges
    c4 = np.array([80, 210, 230])  # high peaks
    c5 = np.array([245, 250, 255]) # summit

    # Piecewise colormap
    t0, t1, t2, t3, t4, t5 = 0.0, 0.25, 0.50, 0.75, 0.90, 1.0

    mask0 = (norm_elev >= t0) & (norm_elev < t1)
    f0 = (norm_elev[mask0] - t0) / (t1 - t0)
    for i in range(3):
        rgb[mask0, i] = c0[i] + f0 * (c1[i] - c0[i])

    mask1 = (norm_elev >= t1) & (norm_elev < t2)
    f1 = (norm_elev[mask1] - t1) / (t2 - t1)
    for i in range(3):
        rgb[mask1, i] = c1[i] + f1 * (c2[i] - c1[i])

    mask2 = (norm_elev >= t2) & (norm_elev < t3)
    f2 = (norm_elev[mask2] - t2) / (t3 - t2)
    for i in range(3):
        rgb[mask2, i] = c2[i] + f2 * (c3[i] - c2[i])

    mask3 = (norm_elev >= t3) & (norm_elev < t4)
    f3 = (norm_elev[mask3] - t3) / (t4 - t3)
    for i in range(3):
        rgb[mask3, i] = c3[i] + f3 * (c4[i] - c3[i])

    mask4 = (norm_elev >= t4) & (norm_elev <= t5)
    f4 = (norm_elev[mask4] - t4) / (t5 - t4)
    for i in range(3):
        rgb[mask4, i] = c4[i] + f4 * (c5[i] - c4[i])

    # Blend with hillshade
    shaded_rgb = rgb * (0.35 + 0.65 * hillshade[:, :, np.newaxis])
    shaded_rgb = np.clip(shaded_rgb, 0.0, 255.0)

    # For pixels outside valid DEM coverage, set to space black
    shaded_rgb[~valid_mask] = [4, 7, 15]

    # Convert to uint8 RGBA
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[:, :, :3] = shaded_rgb.astype(np.uint8)
    rgba[:, :, 3] = np.where(valid_mask, 255, 0).astype(np.uint8)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    img = Image.fromarray(rgba, mode="RGBA")
    img.save(OUTPUT_PATH, format="PNG", optimize=True)
    file_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Generated {OUTPUT_PATH} ({file_size_kb:.1f} KB)")

if __name__ == "__main__":
    generate_lunar_map()
