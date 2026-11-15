# Scientific methods and limits

## Time and evaluated intervals

All backend datetimes are timezone-aware UTC. ISO-8601 numeric offsets convert to UTC; timestamps without an offset explicitly mean UTC. The same convention applies to frontend date controls, quick spans and timeline positions. UTC+05:30 and date-boundary crossings have regression coverage. Request validators reject zero sampling steps.

Analysis `time_range.start_time` and `stop_time` describe the **evaluated** first and last samples. `requested_start_time` and `requested_stop_time` retain the requested range. An unsampled tail is not counted. At least two strictly increasing samples are required. A one-sample response cannot imply 100% availability. Returned samples outside the requested interval are rejected.

## Observer geometry

The reference sphere radius is 1,737,400 m. DEM ground elevation is meters relative to this radius. The physical observer altitude is `ground_elevation_m + observer_height_m`; Horizons receives that sum divided by 1000 in `SITE_COORD` kilometers. Terrain calculations use the same ground-plus-mast convention. Negative datum heights are permitted and tested.

Coordinates are east-positive longitude and south-negative latitude. Terrain is transformed using the actual raster CRS, south polar stereographic with `lat_ts=-90`. The README's earlier 75°S and subpixel-interpolation claims were incorrect. Elevation uses the containing DEM pixel, not bilinear interpolation.

LOLA is in MOON_ME / DE421 as documented by PGDA. Horizons supplies lunar topocentric directions. No fitted frame transform or independent sub-meter NAIF alignment audit has been performed in this project. Former claims of a verified 53.4 cm bound have been removed. Independent frame and observer geometry validation remains a next-stage scientific task.

## Terrain skyline and coverage

For each azimuth, terrain is sampled at 80 m radial intervals for analysis, including the exact configured maximum distance (default 50 km). The existing projection-space straight-ray approximation is retained. With observer radius `r_o=R+h_ground+h_mast`, terrain radius `r_t=R+h_terrain`, and nominal central angle `alpha=distance/R`, apparent terrain elevation is:

`atan2(r_t*cos(alpha)-r_o, r_t*sin(alpha))`.

The skyline is the maximum sampled terrain elevation along each ray. This applies spherical curvature in the angle calculation, while projected path distances and directions remain approximations. Sensitivity to sampling, search radius and projection distortion still needs independent validation. Terrain between sample points and beyond the search radius is not established as clear.

Every requested ray must have all sampled locations within the raster and valid according to finite values, NoData and raster masks. Incomplete coverage returns HTTP 422 with an explicit coverage error; no visibility result is produced. A missing DEM returns HTTP 503. An empty horizon cannot default to zero elevation. This deliberately conservative policy may reject sites near raster edges or data holes. Reducing the radius changes the scientific assumptions and must be disclosed.

## Visibility and windows

The sole occluding surface for this model is the sampled terrain skyline, circularly interpolated at target azimuth. Clearance is target elevation minus skyline elevation, rounded at 12 decimal places to suppress arithmetic noise. Target-center visibility is strictly `clearance > 0`. A separate reference-sphere cutoff is no longer imposed: the datum sphere is not an additional physical occluder inside below-datum terrain.

Approximate finite-disk classification uses constant mean angular radii (Earth 0.95°, Sun 0.267°) compared against that same local skyline clearance. This is a vertical-limb approximation, not disk integration across a varying skyline or a radio/power model.

Transitions use linear clearance-root interpolation between adjacent samples, allowing crossings at either endpoint. The former 1%–99% clamp was removed. Summary durations conserve evaluated visible plus blocked time. Linear interpolation is an estimate; short events between samples can be entirely missed. No guaranteed ±1-step scientific accuracy is asserted.

`earth_comm` and `solar_power` remain legacy API keys for compatibility. They now explicitly mean geometric Earth-center visibility and Sun-center visibility. RF link budgets, Earth ground-station scheduling, panel efficiency/orientation, electrical output, thermal conditions, eclipse occultations and permanent-shadow mapping are not calculated.

The independent skyline chart uses the submitted analysis azimuth step, mast and search distance, rather than a different hardcoded 2° profile.

## Result identity

Each submission captures its inputs. Main and comparison results are hidden and marked stale when any scenario input changes. Generation guards apply to success, error and loading updates so older requests and unmounted components cannot overwrite newer results. Both comparison scenarios are captured together before their sequential NASA calls. Aligned comparison is suppressed if evaluated intervals differ. Elevation previews also clear when coordinates change.

These checks establish implementation consistency, not mission certification. Named presets are illustrative coordinates, not independently certified landing locations or official candidate boundaries. Check them against QuickMap/Moon Trek and source literature before a public demonstration.
