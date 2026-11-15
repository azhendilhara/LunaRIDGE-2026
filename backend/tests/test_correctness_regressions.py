from datetime import timezone
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from app.schemas.ephemeris import parse_date_str
from app.schemas.visibility import parse_utc_datetime, AnalysisRequest
from app.schemas.terrain import HorizonProfileRequest
from app.services.horizons_service import HorizonsService
from app.services.visibility_service import VisibilityService, VisibilityServiceError
from app.services.terrain_service import TerrainService, TerrainServiceError
from test_terrain_service import synthetic_dem_path

@pytest.mark.parametrize('parse', [parse_date_str, parse_utc_datetime])
def test_colombo_offset_crosses_utc_date(parse):
    assert parse('2026-11-14T02:00:00+05:30') == parse('2026-11-13T20:30:00Z')
    assert parse('2026-11-13T20:30:00').tzinfo == timezone.utc

def test_horizons_formats_offset_as_utc():
    assert HorizonsService()._format_time_for_horizons('2026-11-14T02:00:00+05:30') == "'2026-11-13 20:30:00'"

def test_below_datum_visibility_uses_terrain_clearance():
    pt = VisibilityService().evaluate_target_visibility(0, -1, -3, 'earth', 0)
    assert pt.visible and pt.los_status == 'VISIBLE'
    assert pt.disk_occlusion == 'FULLY_VISIBLE'

def test_empty_horizon_is_unknown():
    with pytest.raises(VisibilityServiceError):
        VisibilityService.interpolate_horizon_elevation(0, [])

def test_partial_dem_extent_is_not_clear(synthetic_dem_path):
    with pytest.raises(TerrainServiceError, match='Incomplete DEM coverage'):
        TerrainService(synthetic_dem_path).get_horizon_profile(HorizonProfileRequest(
            latitude=-90, longitude=0, max_distance_km=15, azimuth_step_deg=45))

def test_observer_height_is_shared_with_horizons():
    terrain = Mock()
    terrain.get_elevation.return_value = SimpleNamespace(elevation_m=-1500)
    horizons = Mock()
    horizons.get_ephemeris.return_value = SimpleNamespace(data=[])
    service = VisibilityService(horizons, terrain)
    with pytest.raises(VisibilityServiceError):
        service.analyze_visibility(AnalysisRequest(latitude=-89.9, longitude=0,
            start_time='2026-11-14', stop_time='2026-11-15', observer_height_m=20))
    assert horizons.get_ephemeris.call_args.args[0].altitude == -1.48

@pytest.mark.parametrize('step', ['0h', '0m'])
def test_zero_step_rejected(step):
    with pytest.raises(ValueError):
        AnalysisRequest(latitude=-89.9, longitude=0, start_time='2026-11-14', stop_time='2026-11-15', step_size=step)

def test_nodata_ray_is_not_clear(synthetic_dem_path, tmp_path):
    import shutil
    import rasterio
    from rasterio.windows import Window
    path = tmp_path / 'hole.tif'
    shutil.copyfile(synthetic_dem_path, path)
    with rasterio.open(path, 'r+') as ds:
        import numpy as np
        ds.write(np.array([[np.nan]], dtype='float32'), 1, window=Window(100, 90, 1, 1))
    with pytest.raises(TerrainServiceError, match='Incomplete DEM coverage'):
        TerrainService(str(path)).get_horizon_profile(HorizonProfileRequest(
            latitude=-90, longitude=0, max_distance_km=2, sample_step_m=100, azimuth_step_deg=45))

def test_missing_dem_is_explicit_unavailable(tmp_path):
    service = TerrainService(str(tmp_path / 'absent.tif'))
    with pytest.raises(TerrainServiceError) as exc:
        service.get_horizon_profile(HorizonProfileRequest(latitude=-90, longitude=0))
    assert exc.value.status_code == 503

def test_near_endpoint_transition_is_not_shifted_to_one_percent():
    from app.schemas.visibility import AnalysisPoint
    service = VisibilityService()
    pts = []
    for timestamp, clearance in [('2026-11-14T00:00:00Z', -0.001), ('2026-11-14T01:00:00Z', 1)]:
        target = service.evaluate_target_visibility(0, clearance, 0, 'sun', 0)
        pts.append(AnalysisPoint(timestamp=timestamp, earth=target, sun=target))
    summary = service.identify_windows_and_summary(pts, 'sun', 1)
    assert summary.total_visible_hours == pytest.approx(1 / 1.001, abs=0.0001)
    assert summary.total_visible_hours + summary.total_blocked_hours == pytest.approx(1)

def test_positive_clearance_is_not_serialized_as_zero():
    point = VisibilityService().evaluate_target_visibility(0, 0.00001, 0, 'sun', 0)
    assert point.visible == (point.clearance_deg > 0)

def test_dem_verifier_rejects_size_only_match(tmp_path, monkeypatch):
    import download_dem
    path = tmp_path / 'corrupt.tif'
    path.write_bytes(b'not a DEM')
    monkeypatch.setattr(download_dem, 'EXPECTED_SIZE', path.stat().st_size, raising=False)
    with pytest.raises(ValueError, match='SHA-256'):
        download_dem.verify_dem(path)

def test_raster_mask_hole_is_not_clear(synthetic_dem_path, tmp_path):
    import shutil
    import rasterio
    import numpy as np
    path = tmp_path / 'mask.tif'
    shutil.copyfile(synthetic_dem_path, path)
    with rasterio.open(path, 'r+') as ds:
        mask = np.full(ds.shape, 255, dtype='uint8')
        mask[90, 100] = 0
        ds.write_mask(mask)
    with pytest.raises(TerrainServiceError, match='Incomplete DEM coverage'):
        TerrainService(str(path)).get_horizon_profile(HorizonProfileRequest(
            latitude=-90, longitude=0, max_distance_km=2, sample_step_m=100, azimuth_step_deg=45))

def mock_analysis_service(synthetic_dem_path, timestamps):
    position = SimpleNamespace(azimuth_deg=0, elevation_deg=5)
    horizons = Mock()
    horizons.get_ephemeris.return_value = SimpleNamespace(data=[
        SimpleNamespace(timestamp=ts, earth=position, sun=position) for ts in timestamps])
    return VisibilityService(horizons, TerrainService(synthetic_dem_path))

def test_requested_tail_is_not_invented(synthetic_dem_path):
    service = mock_analysis_service(synthetic_dem_path, ['2026-11-14T00:00:00Z', '2026-11-14T01:00:00Z'])
    result = service.analyze_visibility(AnalysisRequest(latitude=-90, longitude=0,
        start_time='2026-11-14T00:00:00', stop_time='2026-11-14T01:10:00', horizon_max_distance_km=2))
    assert result.time_range.elapsed_hours == 1
    assert result.time_range.stop_time == '2026-11-14T01:00:00Z'
    assert result.time_range.requested_stop_time == '2026-11-14T01:10:00Z'

def test_unsorted_ephemerides_cannot_produce_plausible_summary(synthetic_dem_path):
    service = mock_analysis_service(synthetic_dem_path, ['2026-11-14T01:00:00Z', '2026-11-14T00:00:00Z'])
    with pytest.raises(VisibilityServiceError, match='strictly increasing'):
        service.analyze_visibility(AnalysisRequest(latitude=-90, longitude=0,
            start_time='2026-11-14T00:00:00', stop_time='2026-11-14T02:00:00', horizon_max_distance_km=2))

def test_small_clearance_crossing_uses_root_not_midpoint():
    from app.schemas.visibility import AnalysisPoint
    service = VisibilityService()
    points = []
    for timestamp, clearance in [('2026-11-14T00:00:00Z', -0.0000001), ('2026-11-14T01:00:00Z', 0.0000009)]:
        target = service.evaluate_target_visibility(0, clearance, 0, 'sun', 0)
        points.append(AnalysisPoint(timestamp=timestamp, earth=target, sun=target))
    summary = service.identify_windows_and_summary(points, 'sun', 1)
    assert summary.total_visible_hours == pytest.approx(0.9, abs=0.0001)
