"""NASA JPL Horizons API service for lunar topocentric ephemeris calculations."""

import re
import time
import requests
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from app.schemas.ephemeris import (
    BodyPosition,
    EphemerisPoint,
    EphemerisRequest,
    EphemerisResponse,
    ObserverInfo,
    TimeRangeInfo,
)


class HorizonsAPIError(Exception):
    """Exception raised when NASA JPL Horizons API fails or returns an error."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class HorizonsService:
    """Service interacting with official NASA JPL Horizons API."""

    HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
    TARGET_EARTH = "399"
    TARGET_SUN = "10"
    LUNAR_CENTER = "coord@301"  # Topocentric coordinate on Moon (301)

    def __init__(self, timeout: int = 30, transport=None):
        self.timeout = timeout
        self.transport = transport or requests

    def _format_time_for_horizons(self, time_str: str) -> str:
        """Format datetime string to 'YYYY-MM-DD HH:MM:SS' for Horizons."""
        from app.schemas.ephemeris import parse_date_str
        return parse_date_str(time_str).strftime("'%Y-%m-%d %H:%M:%S'")

    def query_target(
        self,
        command: str,
        latitude: float,
        longitude: float,
        altitude_km: float,
        start_time: str,
        stop_time: str,
        step_size: str,
    ) -> List[Dict]:
        """Query NASA JPL Horizons for a single celestial target.

        Reference frame: Topocentric observer on the Moon ('coord@301').
        Coordinate convention:
            SITE_COORD is formatted as '{E-longitude},{latitude},{altitude_km}'.
            Quantity '4' selects airless apparent azimuth and elevation.
            Azimuth: degrees clockwise from North (0° = N, 90° = E, 180° = S, 270° = W).
            Elevation: degrees above local horizontal plane (-90° nadir to +90° zenith).
        """
        # Horizons expects SITE_COORD as 'lon,lat,alt' with East longitude positive
        site_coord = f"'{longitude},{latitude},{altitude_km}'"
        formatted_start = self._format_time_for_horizons(start_time)
        formatted_stop = self._format_time_for_horizons(stop_time)

        params = {
            "format": "json",
            "COMMAND": f"'{command}'",
            "EPHEM_TYPE": "'OBSERVER'",
            "TIME_TYPE": "'UT'",
            "APPARENT": "'AIRLESS'",
            "CENTER": f"'{self.LUNAR_CENTER}'",
            "SITE_COORD": site_coord,
            "START_TIME": formatted_start,
            "STOP_TIME": formatted_stop,
            "STEP_SIZE": f"'{step_size}'",
            "QUANTITIES": "'4'",
            "CSV_FORMAT": "'YES'",
            "TIME_DIGITS": "'SECONDS'",
            "CAL_FORMAT": "'CAL'",
            "ANG_FORMAT": "'DEG'",
        }

        max_retries = 3
        response = None
        for attempt in range(max_retries):
            try:
                response = self.transport.get(
                    self.HORIZONS_API_URL, params=params, timeout=self.timeout
                )
                if response.status_code == 200:
                    break
                elif response.status_code in (502, 503, 504, 429) and attempt < max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                else:
                    break
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                raise HorizonsAPIError(
                    "NASA JPL Horizons API request timed out after 30 seconds.",
                    status_code=504,
                )
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                raise HorizonsAPIError(
                    f"Network error contacting NASA JPL Horizons API: {str(e)}",
                    status_code=502,
                )

        if response is None or response.status_code != 200:
            status_code = response.status_code if response is not None else 502
            err_text = response.text[:200] if response is not None else "No response"
            raise HorizonsAPIError(
                f"NASA JPL Horizons API returned HTTP {status_code}: {err_text}",
                status_code=502,
            )

        try:
            data = response.json()
        except Exception:
            raise HorizonsAPIError(
                "Failed to parse JSON response from NASA JPL Horizons API.",
                status_code=502,
            )

        # Check for explicit NASA API errors
        if "error" in data:
            raise HorizonsAPIError(
                f"NASA JPL Horizons error: {data['error']}",
                status_code=400,
            )

        result_text = data.get("result", "")
        return self._parse_ephemeris_table(result_text)

    def _parse_ephemeris_table(self, result_text: str) -> List[Dict]:
        """Parse CSV rows between $$SOE and $$EOE markers from Horizons output."""
        soe_marker = "$$SOE"
        eoe_marker = "$$EOE"

        soe_idx = result_text.find(soe_marker)
        eoe_idx = result_text.find(eoe_marker)

        if soe_idx == -1 or eoe_idx == -1:
            # Check if there is an error explanation in the result text
            lines = [l.strip() for l in result_text.splitlines() if l.strip()]
            error_msg = lines[-1] if lines else "No ephemeris table generated."
            raise HorizonsAPIError(
                f"NASA JPL Horizons did not return ephemeris data. Reason: {error_msg}",
                status_code=400,
            )

        table_content = result_text[soe_idx + len(soe_marker) : eoe_idx].strip()
        records = []

        for line in table_content.splitlines():
            line = line.strip()
            if not line or line.startswith("$$"):
                continue

            parts = [p.strip() for p in line.split(",")]
            # Line format with CSV_FORMAT='YES' and QUANTITIES='4':
            # Date__(UT)__HR:MN:SS, Solar_presence, Interfering_body, Azi_(a-app), Elev_(a-app), [empty]
            if len(parts) < 5:
                continue

            raw_time = parts[0]
            solar_flag = parts[1] if len(parts) > 1 else ""
            interfering_flag = parts[2] if len(parts) > 2 else ""

            try:
                azimuth = float(parts[3])
                elevation = float(parts[4])
            except ValueError:
                continue

            # Standardize timestamp to ISO-8601 UTC
            iso_time = self._convert_horizons_time_to_iso(raw_time)

            records.append(
                {
                    "raw_time": raw_time,
                    "timestamp": iso_time,
                    "azimuth_deg": azimuth,
                    "elevation_deg": elevation,
                    "altitude_deg": elevation,
                    "visible": elevation > 0.0,
                    "solar_presence": solar_flag if solar_flag else None,
                    "interfering_presence": (
                        interfering_flag if interfering_flag else None
                    ),
                }
            )

        if not records:
            raise HorizonsAPIError(
                "Parsed ephemeris table contained zero valid measurement points.",
                status_code=502,
            )

        return records

    def _convert_horizons_time_to_iso(self, raw_time: str) -> str:
        """Convert Horizons date like '2026-Nov-06 00:00:00' to ISO-8601 '2026-11-06T00:00:00Z'."""
        raw_time = raw_time.strip()
        for fmt in ("%Y-%b-%d %H:%M:%S", "%Y-%b-%d %H:%M"):
            try:
                dt = datetime.strptime(raw_time, fmt)
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                continue
        # Fallback if already ISO or unusual format
        return raw_time

    def get_ephemeris(self, req: EphemerisRequest) -> EphemerisResponse:
        """Retrieve real ephemeris for both Earth and Sun from NASA JPL Horizons and merge by timestamp."""
        earth_records = self.query_target(
            command=self.TARGET_EARTH,
            latitude=req.latitude,
            longitude=req.longitude,
            altitude_km=req.altitude,
            start_time=req.start_time,
            stop_time=req.stop_time,
            step_size=req.step_size,
        )

        sun_records = self.query_target(
            command=self.TARGET_SUN,
            latitude=req.latitude,
            longitude=req.longitude,
            altitude_km=req.altitude,
            start_time=req.start_time,
            stop_time=req.stop_time,
            step_size=req.step_size,
        )

        # Index Sun records by timestamp for O(1) alignment
        sun_map = {r["timestamp"]: r for r in sun_records}

        points: List[EphemerisPoint] = []
        for e in earth_records:
            ts = e["timestamp"]
            s = sun_map.get(ts)
            if not s:
                # If exact timestamp match fails due to format edge case, try matching by raw_time
                for candidate in sun_records:
                    if candidate["raw_time"] == e["raw_time"]:
                        s = candidate
                        break

            if not s:
                continue

            earth_pos = BodyPosition(
                azimuth_deg=round(e["azimuth_deg"], 4),
                elevation_deg=round(e["elevation_deg"], 4),
                altitude_deg=round(e["elevation_deg"], 4),
                visible=e["visible"],
                solar_presence=e["solar_presence"],
            )
            sun_pos = BodyPosition(
                azimuth_deg=round(s["azimuth_deg"], 4),
                elevation_deg=round(s["elevation_deg"], 4),
                altitude_deg=round(s["elevation_deg"], 4),
                visible=s["visible"],
                solar_presence=s["solar_presence"],
            )

            points.append(
                EphemerisPoint(
                    timestamp=ts,
                    earth=earth_pos,
                    sun=sun_pos,
                )
            )

        return EphemerisResponse(
            status="success",
            source="NASA JPL Horizons On-Line Ephemeris System",
            observer=ObserverInfo(
                latitude=req.latitude,
                longitude=req.longitude,
                altitude_km=req.altitude,
            ),
            time_range=TimeRangeInfo(
                start_time=req.start_time,
                stop_time=req.stop_time,
                step_size=req.step_size,
            ),
            count=len(points),
            data=points,
        )
