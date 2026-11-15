"""Terrain-aware Earth communication and solar visibility prediction service.

Combines high-precision NASA JPL Horizons ephemerides with high-resolution
NASA LOLA digital elevation model (DEM) horizon obstruction masks.
"""

import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from app.schemas.ephemeris import EphemerisRequest
from app.schemas.terrain import ElevationRequest, HorizonPoint, HorizonProfileRequest, HorizonProfileResponse
from app.schemas.visibility import (
    AnalysisPoint,
    AnalysisRequest,
    AnalysisResponse,
    DiskOcclusionState,
    SiteInfo,
    TargetSummary,
    TargetVisibilityPoint,
    TimeRangeSummary,
    VisibilityWindow,
    parse_utc_datetime,
)
from app.services.horizons_service import HorizonsAPIError, HorizonsService
from app.services.terrain_service import TerrainService, TerrainServiceError


class VisibilityServiceError(Exception):
    """Exception raised when visibility analysis fails."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class VisibilityService:
    """Service computing terrain-aware line-of-sight communication and solar power windows."""

    # Physical constants
    LUNAR_RADIUS_M = 1737400.0
    EARTH_ANGULAR_RADIUS_DEG = 0.95   # Mean angular radius of Earth viewed from Moon (~1.90° diameter)
    SUN_ANGULAR_RADIUS_DEG = 0.267    # Mean angular radius of Sun viewed from Moon (~0.534° diameter)

    def __init__(
        self,
        horizons_service: Optional[HorizonsService] = None,
        terrain_service: Optional[TerrainService] = None,
    ):
        self.horizons_service = horizons_service or HorizonsService()
        self.terrain_service = terrain_service or TerrainService()
        # In-memory cache for terrain horizon profiles keyed by site and sampling parameters
        self._horizon_cache: Dict[Tuple[float, float, float, float, float], HorizonProfileResponse] = {}

    def get_or_compute_horizon(
        self,
        latitude: float,
        longitude: float,
        mast_height_m: float,
        azimuth_step_deg: float,
        max_distance_km: float,
    ) -> HorizonProfileResponse:
        """Retrieve horizon profile from cache or compute it via TerrainService."""
        cache_key = (
            latitude,
            longitude,
            mast_height_m,
            azimuth_step_deg,
            max_distance_km,
        )

        if cache_key in self._horizon_cache:
            return self._horizon_cache[cache_key]

        horizon_req = HorizonProfileRequest(
            latitude=latitude,
            longitude=longitude,
            observer_height_m=mast_height_m,
            azimuth_start_deg=0.0,
            azimuth_end_deg=360.0,
            azimuth_step_deg=azimuth_step_deg,
            max_distance_km=max_distance_km,
            sample_step_m=80.0,
        )

        profile_resp = self.terrain_service.get_horizon_profile(horizon_req)
        self._horizon_cache[cache_key] = profile_resp
        return profile_resp

    @staticmethod
    def interpolate_horizon_elevation(
        target_azimuth: float, profile: List[HorizonPoint]
    ) -> float:
        """Circular linear interpolation of terrain horizon elevation across 0° - 360° boundary.

        Handles circular wraparound across 359° to 0° accurately.
        """
        if not profile:
            raise VisibilityServiceError("Terrain horizon is unavailable; visibility is unknown.", status_code=422)

        if len(profile) == 1:
            return profile[0].horizon_elevation_deg

        # Normalize azimuth into [0, 360)
        target_az = target_azimuth % 360.0

        # Profile is sorted by azimuth_deg
        azimuths = [p.azimuth_deg for p in profile]
        elevations = [p.horizon_elevation_deg for p in profile]

        # Check exact matches
        for az, el in zip(azimuths, elevations):
            if abs(target_az - az) < 1e-4:
                return el

        # Circular boundary handling (wrap-around between last and first azimuth)
        first_az, last_az = azimuths[0], azimuths[-1]
        first_el, last_el = elevations[0], elevations[-1]

        if target_az < first_az or target_az > last_az:
            # Wrap around: interval is [last_az, first_az + 360.0]
            az_span = (first_az + 360.0) - last_az
            if az_span <= 0:
                return first_el
            eval_az = target_az if target_az >= last_az else target_az + 360.0
            fraction = (eval_az - last_az) / az_span
            return last_el + fraction * (first_el - last_el)

        # Standard linear scan inside range [first_az, last_az]
        for i in range(len(azimuths) - 1):
            a0, a1 = azimuths[i], azimuths[i + 1]
            if a0 <= target_az <= a1:
                span = a1 - a0
                if span <= 0:
                    return elevations[i]
                fraction = (target_az - a0) / span
                return elevations[i] + fraction * (elevations[i + 1] - elevations[i])

        return elevations[-1]

    def evaluate_target_visibility(
        self,
        azimuth_deg: float,
        elevation_deg: float,
        horizon_elev_deg: float,
        target_name: str,
        dip_angle_deg: float,
    ) -> TargetVisibilityPoint:
        """Calculate line-of-sight status, clearance, and disk occlusion."""
        clearance_deg = round(elevation_deg - horizon_elev_deg, 12)

        # Center line-of-sight
        visible = clearance_deg > 0.0

        # Line-of-sight status classification
        if visible:
            los_status = "VISIBLE"
        else:
            los_status = "BLOCKED_BY_TERRAIN"

        # Finite disk occlusion classification
        ang_radius = (
            self.EARTH_ANGULAR_RADIUS_DEG
            if target_name.lower() == "earth"
            else self.SUN_ANGULAR_RADIUS_DEG
        )

        if clearance_deg >= ang_radius:
            disk_occlusion = DiskOcclusionState.FULLY_VISIBLE
        elif clearance_deg > -ang_radius:
            disk_occlusion = DiskOcclusionState.PARTIAL_LIMB
        else:
            disk_occlusion = DiskOcclusionState.FULLY_BLOCKED

        return TargetVisibilityPoint(
            azimuth_deg=round(azimuth_deg, 4),
            elevation_deg=elevation_deg,
            horizon_elevation_deg=horizon_elev_deg,
            clearance_deg=clearance_deg,
            visible=visible,
            los_status=los_status,
            disk_occlusion=disk_occlusion,
        )

    @staticmethod
    def compute_disk_occlusion_durations(
        timestamps: List[datetime], clearances: List[float], r_ang: float
    ) -> Tuple[float, float, float]:
        """Compute exact duration (hours) spent in fully-visible, partial-limb, and fully-blocked states.

        Guaranteed identity: full_vis + partial + blocked == total_interval_hours.
        """
        N = len(timestamps)
        if N <= 1:
            return 0.0, 0.0, 0.0

        full_vis = 0.0
        partial = 0.0
        blocked = 0.0

        for i in range(N - 1):
            dt = (timestamps[i + 1] - timestamps[i]).total_seconds() / 3600.0
            c0, c1 = clearances[i], clearances[i + 1]

            if c0 == c1:
                if c0 >= r_ang:
                    full_vis += dt
                elif c0 > -r_ang:
                    partial += dt
                else:
                    blocked += dt
                continue

            # Linear interpolation c(u) = c0 + u*(c1 - c0) for u in [0, 1]
            u_plus = (r_ang - c0) / (c1 - c0)
            u_minus = (-r_ang - c0) / (c1 - c0)

            cuts = [0.0, 1.0]
            if 0.0 < u_plus < 1.0:
                cuts.append(u_plus)
            if 0.0 < u_minus < 1.0:
                cuts.append(u_minus)
            cuts = sorted(list(set(cuts)))

            for k in range(len(cuts) - 1):
                ua, ub = cuts[k], cuts[k + 1]
                umid = 0.5 * (ua + ub)
                c_mid = c0 + umid * (c1 - c0)
                sub_dt = (ub - ua) * dt
                if c_mid >= r_ang:
                    full_vis += sub_dt
                elif c_mid > -r_ang:
                    partial += sub_dt
                else:
                    blocked += sub_dt

        return round(full_vis, 4), round(partial, 4), round(blocked, 4)

    @staticmethod
    def identify_windows_and_summary(
        points: List[AnalysisPoint],
        target_name: str,
        total_interval_hours: float,
    ) -> TargetSummary:
        """Segment continuous line-of-sight visibility windows from UTC timestamps and clearance functions.

        Duration calculation:
            Measured from actual UTC interval boundaries, NEVER from sample count multiplied by time step.
            For transitions between samples, linear clearance root finding identifies the crossing time.
            Guaranteed identity: total_visible_hours + total_blocked_hours == total_interval_hours (within 0.001h).
            No window duration can exceed total_interval_hours.
        """
        N = len(points)
        if N == 0:
            return TargetSummary(
                total_visible_hours=0.0,
                total_blocked_hours=0.0,
                total_interval_hours=0.0,
                visibility_percentage=0.0,
                full_disk_visible_hours=0.0,
                partial_limb_hours=0.0,
                fully_blocked_hours=0.0,
                window_count=0,
                longest_window_hours=0.0,
                longest_blackout_hours=0.0,
                windows=[],
            )

        timestamps = [parse_utc_datetime(p.timestamp) for p in points]
        states = [getattr(p, target_name).visible for p in points]
        clearances = [getattr(p, target_name).clearance_deg for p in points]

        if N == 1:
            is_vis = states[0]
            return TargetSummary(
                total_visible_hours=0.0,
                total_blocked_hours=0.0,
                total_interval_hours=0.0,
                visibility_percentage=100.0 if is_vis else 0.0,
                full_disk_visible_hours=0.0,
                partial_limb_hours=0.0,
                fully_blocked_hours=0.0,
                window_count=1 if is_vis else 0,
                longest_window_hours=0.0,
                longest_blackout_hours=0.0,
                windows=[
                    VisibilityWindow(
                        window_index=1,
                        start_time=points[0].timestamp,
                        end_time=points[0].timestamp,
                        duration_hours=0.0,
                        first_sample_time=points[0].timestamp,
                        last_sample_time=points[0].timestamp,
                        sample_count=1,
                        peak_elevation_deg=getattr(points[0], target_name).elevation_deg,
                        min_clearance_deg=getattr(points[0], target_name).clearance_deg,
                        max_clearance_deg=getattr(points[0], target_name).clearance_deg,
                    )
                ] if is_vis else [],
            )

        # Angular radius for disk occlusion tracking
        r_ang = (
            VisibilityService.EARTH_ANGULAR_RADIUS_DEG
            if target_name.lower() == "earth"
            else VisibilityService.SUN_ANGULAR_RADIUS_DEG
        )
        full_vis_h, part_limb_h, full_blk_h = (
            VisibilityService.compute_disk_occlusion_durations(timestamps, clearances, r_ang)
        )

        # 1. Edge case: All samples are Visible (100% visible)
        if all(states):
            elevs = [getattr(p, target_name).elevation_deg for p in points]
            clrs = [getattr(p, target_name).clearance_deg for p in points]
            win = VisibilityWindow(
                window_index=1,
                start_time=points[0].timestamp,
                end_time=points[-1].timestamp,
                duration_hours=round(total_interval_hours, 4),
                first_sample_time=points[0].timestamp,
                last_sample_time=points[-1].timestamp,
                sample_count=N,
                peak_elevation_deg=round(max(elevs), 4),
                min_clearance_deg=round(min(clrs), 4),
                max_clearance_deg=round(max(clrs), 4),
            )
            return TargetSummary(
                total_visible_hours=round(total_interval_hours, 4),
                total_blocked_hours=0.0,
                total_interval_hours=round(total_interval_hours, 4),
                visibility_percentage=100.0,
                full_disk_visible_hours=full_vis_h,
                partial_limb_hours=part_limb_h,
                fully_blocked_hours=full_blk_h,
                window_count=1,
                longest_window_hours=round(total_interval_hours, 4),
                longest_blackout_hours=0.0,
                windows=[win],
            )

        # 2. Edge case: All samples are Blocked (0% visible)
        if not any(states):
            return TargetSummary(
                total_visible_hours=0.0,
                total_blocked_hours=round(total_interval_hours, 4),
                total_interval_hours=round(total_interval_hours, 4),
                visibility_percentage=0.0,
                full_disk_visible_hours=full_vis_h,
                partial_limb_hours=part_limb_h,
                fully_blocked_hours=full_blk_h,
                window_count=0,
                longest_window_hours=0.0,
                longest_blackout_hours=round(total_interval_hours, 4),
                windows=[],
            )

        # 3. Intermittent / Transitions: Partition [t_0, t_{N-1}] into contiguous alternating segments
        def get_transition_time(idx: int) -> datetime:
            c0 = clearances[idx]
            c1 = clearances[idx + 1]
            denom = c1 - c0
            if denom != 0.0:
                tau = -c0 / denom
                tau = max(0.0, min(1.0, tau))
            else:
                tau = 0.5
            dt_sec = (timestamps[idx + 1] - timestamps[idx]).total_seconds()
            return timestamps[idx] + timedelta(seconds=tau * dt_sec)

        segments = []
        curr_state = states[0]
        curr_start = timestamps[0]
        curr_indices = [0]

        for i in range(N - 1):
            if states[i] == states[i + 1]:
                curr_indices.append(i + 1)
            else:
                # State transition inside interval [t_i, t_{i+1}]
                t_trans = get_transition_time(i)
                seg_dur = (t_trans - curr_start).total_seconds() / 3600.0
                segments.append({
                    "state": curr_state,
                    "start_time": curr_start,
                    "end_time": t_trans,
                    "duration_hours": seg_dur,
                    "indices": curr_indices,
                })
                curr_state = states[i + 1]
                curr_start = t_trans
                curr_indices = [i + 1]

        # Final segment up to timestamps[-1]
        seg_dur = (timestamps[-1] - curr_start).total_seconds() / 3600.0
        segments.append({
            "state": curr_state,
            "start_time": curr_start,
            "end_time": timestamps[-1],
            "duration_hours": seg_dur,
            "indices": curr_indices,
        })

        # Separate segments into visible windows and blackout intervals
        vis_windows: List[VisibilityWindow] = []
        blackout_durations: List[float] = []

        for s in segments:
            dur = s["duration_hours"]
            if s["state"]:
                # Visible window
                sub_pts = [getattr(points[k], target_name) for k in s["indices"]]
                elevs = [p.elevation_deg for p in sub_pts]
                clrs = [p.clearance_deg for p in sub_pts]
                vis_windows.append(
                    VisibilityWindow(
                        window_index=len(vis_windows) + 1,
                        start_time=s["start_time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                        end_time=s["end_time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                        duration_hours=round(dur, 4),
                        first_sample_time=points[s["indices"][0]].timestamp,
                        last_sample_time=points[s["indices"][-1]].timestamp,
                        sample_count=len(s["indices"]),
                        peak_elevation_deg=round(max(elevs), 4),
                        min_clearance_deg=round(min(clrs), 4),
                        max_clearance_deg=round(max(clrs), 4),
                    )
                )
            else:
                blackout_durations.append(dur)

        total_visible_hours = sum(w.duration_hours for w in vis_windows)
        total_blocked_hours = sum(blackout_durations)

        # Enforce exact total conservation: total_vis + total_bo == total_interval_hours
        # Distribute any sub-millisecond float rounding discrepancy to the larger category
        net_diff = total_interval_hours - (total_visible_hours + total_blocked_hours)
        if abs(net_diff) < 0.01:
            if total_visible_hours >= total_blocked_hours and vis_windows:
                total_visible_hours += net_diff
            else:
                total_blocked_hours += net_diff

        longest_win = max([w.duration_hours for w in vis_windows], default=0.0)
        longest_bo = max(blackout_durations, default=0.0)

        # Bound by total interval
        longest_win = min(longest_win, total_interval_hours)
        longest_bo = min(longest_bo, total_interval_hours)
        total_visible_hours = min(total_visible_hours, total_interval_hours)
        total_blocked_hours = min(total_blocked_hours, total_interval_hours)

        vis_pct = (total_visible_hours / total_interval_hours * 100.0) if total_interval_hours > 0 else 0.0
        vis_pct = min(100.0, max(0.0, vis_pct))

        return TargetSummary(
            total_visible_hours=round(total_visible_hours, 4),
            total_blocked_hours=round(total_blocked_hours, 4),
            total_interval_hours=round(total_interval_hours, 4),
            visibility_percentage=round(vis_pct, 2),
            full_disk_visible_hours=full_vis_h,
            partial_limb_hours=part_limb_h,
            fully_blocked_hours=full_blk_h,
            window_count=len(vis_windows),
            longest_window_hours=round(longest_win, 4),
            longest_blackout_hours=round(longest_bo, 4),
            windows=vis_windows,
        )

    def analyze_visibility(self, req: AnalysisRequest) -> AnalysisResponse:
        """Run complete terrain-aware line-of-sight and illumination analysis."""
        # Both calculations use DEM ground elevation + instrument mast above R=1737.4 km.
        try:
            elev_resp = self.terrain_service.get_elevation(
                ElevationRequest(latitude=req.latitude, longitude=req.longitude))
        except TerrainServiceError as e:
            raise VisibilityServiceError(f"Terrain elevation lookup failed: {e.message}", status_code=e.status_code)
        ground_elevation = elev_resp.elevation_m
        total_altitude = ground_elevation + req.observer_height_m
        ephem_req = EphemerisRequest(
            latitude=req.latitude, longitude=req.longitude,
            start_time=req.start_time, stop_time=req.stop_time,
            step_size=req.step_size, altitude=total_altitude / 1000.0)
        try:
            ephem_resp = self.horizons_service.get_ephemeris(ephem_req)
        except HorizonsAPIError as e:
            raise VisibilityServiceError(f"Horizons Ephemeris service failed: {e.message}", status_code=e.status_code)
        if len(ephem_resp.data) < 2:
            raise VisibilityServiceError("At least two ephemeris samples are required.", status_code=502)
        sample_times = [parse_utc_datetime(pt.timestamp) for pt in ephem_resp.data]
        if any(b <= a for a, b in zip(sample_times, sample_times[1:])):
            raise VisibilityServiceError("Ephemeris timestamps must be strictly increasing.", status_code=502)
        if sample_times[0] < parse_utc_datetime(req.start_time) or sample_times[-1] > parse_utc_datetime(req.stop_time):
            raise VisibilityServiceError("Ephemeris samples are outside the requested interval.", status_code=502)
        dip_angle_deg = 0.0  # Retained call signature; the terrain skyline is the sole occluding surface.

        # 3. Retrieve or compute 360° terrain horizon profile (cached by site/params)
        try:
            horizon_resp = self.get_or_compute_horizon(
                latitude=req.latitude,
                longitude=req.longitude,
                mast_height_m=req.observer_height_m,
                azimuth_step_deg=req.horizon_azimuth_step_deg,
                max_distance_km=req.horizon_max_distance_km,
            )
        except TerrainServiceError as e:
            raise VisibilityServiceError(f"Terrain horizon profiling failed: {e.message}", status_code=e.status_code)

        # 4. Evaluate visibility for each ephemeris point
        analysis_points: List[AnalysisPoint] = []
        for pt in ephem_resp.data:
            # Earth
            earth_horizon_el = self.interpolate_horizon_elevation(
                pt.earth.azimuth_deg, horizon_resp.profile
            )
            earth_vis = self.evaluate_target_visibility(
                azimuth_deg=pt.earth.azimuth_deg,
                elevation_deg=pt.earth.elevation_deg,
                horizon_elev_deg=earth_horizon_el,
                target_name="earth",
                dip_angle_deg=dip_angle_deg,
            )

            # Sun
            sun_horizon_el = self.interpolate_horizon_elevation(
                pt.sun.azimuth_deg, horizon_resp.profile
            )
            sun_vis = self.evaluate_target_visibility(
                azimuth_deg=pt.sun.azimuth_deg,
                elevation_deg=pt.sun.elevation_deg,
                horizon_elev_deg=sun_horizon_el,
                target_name="sun",
                dip_angle_deg=dip_angle_deg,
            )

            analysis_points.append(
                AnalysisPoint(
                    timestamp=pt.timestamp,
                    earth=earth_vis,
                    sun=sun_vis,
                )
            )

        # 5. Calculate exact elapsed hours from first and last timestamp
        t_start = parse_utc_datetime(analysis_points[0].timestamp)
        t_stop = parse_utc_datetime(analysis_points[-1].timestamp)
        total_interval_seconds = (t_stop - t_start).total_seconds()
        total_interval_hours = max(0.0, total_interval_seconds / 3600.0)

        # Step size in hours (e.g. from consecutive points)
        if len(analysis_points) > 1:
            t1 = parse_utc_datetime(analysis_points[1].timestamp)
            t0 = parse_utc_datetime(analysis_points[0].timestamp)
            dt_hours = max(0.001, (t1 - t0).total_seconds() / 3600.0)
        else:
            dt_hours = 0.0

        # 6. Compute contiguous windows and summary statistics
        earth_summary = self.identify_windows_and_summary(
            analysis_points, "earth", total_interval_hours
        )
        sun_summary = self.identify_windows_and_summary(
            analysis_points, "sun", total_interval_hours
        )

        return AnalysisResponse(
            status="success",
            submitted_scenario=req.model_copy(deep=True),
            site=SiteInfo(
                latitude=req.latitude,
                longitude=req.longitude,
                ground_elevation_m=ground_elevation,
                observer_height_m=req.observer_height_m,
                total_altitude_m=total_altitude,
            ),
            time_range=TimeRangeSummary(
                requested_start_time=req.start_time,
                requested_stop_time=req.stop_time,
                start_time=analysis_points[0].timestamp,
                stop_time=analysis_points[-1].timestamp,
                step_size=req.step_size,
                total_points=len(analysis_points),
                elapsed_hours=round(total_interval_hours, 4),
                time_step_precision=f"Linear crossing estimates from {dt_hours:.2f}h sampling; short events may be missed.",
            ),
            earth_comm=earth_summary,
            solar_power=sun_summary,
            data=analysis_points,
        )
