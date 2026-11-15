"""Recorded evidence checks (offline), distinct from live validation harness."""
import json
from pathlib import Path
import pytest
from app.schemas.ephemeris import ObserverInfo
from app.schemas.visibility import SiteInfo
ROOT=Path(__file__).resolve().parents[2]/'docs/validation-step13'

def test_frame_metadata_distinguishes_surface_frame_from_ephemeris():
    info=ObserverInfo(latitude=-89,longitude=0,altitude_km=0)
    assert 'DE421' in info.reference_frame and 'DE441' in info.reference_frame
    site=SiteInfo(latitude=-89,longitude=0,ground_elevation_m=0,observer_height_m=2,total_altitude_m=2)
    assert 'DE421' in site.reference_frame

def test_recorded_high_precision_nasa_references():
    references=json.loads((ROOT/'references.json').read_text())
    assert len(references)==3
    for targets in references.values():
        for ref in targets.values():
            assert len(ref['values'])==3
            for row in ref['values']:
                assert abs(row['azimuth_difference_deg'])<0.000051
                assert abs(row['elevation_difference_deg'])<0.000051

@pytest.mark.parametrize('name',['nobile36','degerlache492','haworth492'])
def test_recorded_summary_matches_clearance_and_windows(name):
    data=json.loads((ROOT/f'{name}-analysis.json').read_text())
    for target,field in [('earth','earth_comm'),('sun','solar_power')]:
        for point in data['data']:
            p=point[target]
            assert p['visible']==(p['clearance_deg']>0)
            assert p['clearance_deg']==pytest.approx(p['elevation_deg']-p['horizon_elevation_deg'],abs=1e-10)
            radius=0.95 if target=='earth' else 0.267
            expected='FULLY_VISIBLE' if p['clearance_deg']>=radius else 'PARTIAL_LIMB' if p['clearance_deg']>-radius else 'FULLY_BLOCKED'
            assert p['disk_occlusion']==expected
        s=data[field]
        assert s['total_visible_hours']+s['total_blocked_hours']==pytest.approx(data['time_range']['elapsed_hours'],abs=0.001)
        assert sum(w['duration_hours'] for w in s['windows'])==pytest.approx(s['total_visible_hours'],abs=0.001)
        for w in s['windows']:
            from app.schemas.visibility import parse_utc_datetime
            assert (parse_utc_datetime(w['end_time'])-parse_utc_datetime(w['start_time'])).total_seconds()/3600==pytest.approx(w['duration_hours'],abs=0.0004)
