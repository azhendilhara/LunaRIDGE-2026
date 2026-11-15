# Step 13 — scientific validation

Validated 14 November 2026. All numbers below come from saved NASA queries and the local pinned LOLA raster. No application scientific calculation or coordinate was changed to obtain a preferred result.

## Main finding

**The reported zero-sunlight results are reproducible and plausible for the entered coordinates and finite search settings.** Haworth reproduces 27.93% Earth visibility (137.433 hours). Independent Horizons reference queries and a separately implemented geodesic/ECEF terrain calculation support the zero cases. No numerical defect causing these zeros was demonstrated. A misleading frame label was reproduced by a regression test and corrected without changing calculations.

This is validation of these sampled scenarios and the integration, not mission certification, a complete terrain error budget, or proof of permanent shadow. The supplied rim/summit preset names and approximate elevations are not independently verified geographic identifications.

## Input identity and reproducibility limits

The application stores scenarios only in React memory; it has no localStorage/sessionStorage/history persistence. The supplied observations omit the Nobile dates and exact sampling/mast settings and describe Site A coordinates approximately. A clarification was requested. No historical submitted payload was available in project files; the currently active browser window was on another document. Therefore **exact historical-input recovery cannot be claimed**. The following are explicit reconstructions using the stored code/preset numeric values, 2 m mast, hourly sampling, 1° azimuth spacing, 80 m radial sampling and 50 km search radius. The Haworth output match strongly corroborates the comparison reconstruction but does not prove every past input.

| Reconstruction | Latitude / east-positive longitude | Evaluated UTC interval | Samples | DEM ground (m) |
|---|---|---|---:|---:|
| nobile36 | -85.25, 53.5 | 2026-11-06T00:00:00Z → 2026-11-07T12:00:00Z | 37 | 826.02 |
| degerlache492 | -88.5, -88.3 | 2026-11-06T00:00:00Z → 2026-11-26T12:00:00Z | 493 | -1103.41 |
| haworth492 | -87.87, -5.1 | 2026-11-06T00:00:00Z → 2026-11-26T12:00:00Z | 493 | -3484.79 |

Nobile dates use the stored default 2026-11-06 00:00 → 2026-11-07 12:00 UTC (36 h), pending confirmation. Comparison dates are the user-supplied 2026-11-06 00:00 → 2026-11-26 12:00 UTC (492 h). Inputs and all points are saved in `baseline.json` and each `*-analysis.json`.

## Zero-case diagnostics (degrees)

Skyline ranges below are evaluated at the target’s actual sampled azimuths, not across all 360°. Clearance extrema use the paired elevation and skyline at each time; subtracting unrelated range extrema is not equivalent.

| Scenario | Target | Azimuth range | Elevation range | Relevant skyline range | Clearance range | Visible % / h |
|---|---|---|---|---|---|---|
| nobile36 | earth | 311.81770 … 312.20080 | -2.67680 … -1.18920 | 7.66662 … 7.68151 | -10.35831 … -8.85582 | 0.00% / 0.0000 |
| nobile36 | sun | 152.39040 … 170.70100 | -3.17880 … -2.68580 | -0.04710 … 2.36990 | -5.54870 … -2.63870 | 0.00% / 0.0000 |
| degerlache492 | earth | 81.15180 … 93.73620 | -6.85670 … 6.38790 | 8.13630 … 9.51244 | -15.66509 … -2.36674 | 0.00% / 0.0000 |
| degerlache492 | sun | 63.05670 … 312.47330 | 0.05360 … 2.52220 | 3.26368 … 16.82160 | -16.47330 … -1.34717 | 0.00% / 0.0000 |
| haworth492 | earth | 0.01760 … 359.98100 | -4.70710 … 8.38430 | 6.23479 … 6.90805 | -11.51462 … 1.73639 | 27.93% / 137.4330 |
| haworth492 | sun | 0.03240 … 359.52610 | -0.58570 … 3.64880 | 4.41700 … 11.06230 | -11.17883 … -1.82653 | 0.00% / 0.0000 |

Nobile: Earth remains below a high skyline and the Sun is below the local horizontal throughout this 36-hour window. De Gerlache: Sun elevation reaches 2.5222° but remains below the paired terrain skyline. Haworth: Sun reaches 3.6488° but still never clears the paired skyline. Thus a positive elevation above the reference horizontal alone does not imply sunlight.

## Independent NASA Horizons references

[NASA Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [API configuration](https://ssd-api.jpl.nasa.gov/doc/horizons.html). The reference client does not call the application service or its CSV parser. It makes separately configured plain-text requests with extra precision, explicit GEODETIC coordinates, lunar center `coord@301`, UTC, AIRLESS apparent directions, quantity 4, and no elevation/daylight cutoffs. Three times per scenario/target (start, midpoint, end) are checked; full 1 h/10 min series are application-client data, not independent reference points.

The raw `*-reference.txt` headers show MEAN_ME, east-positive longitude, the submitted ground-plus-mast altitude, and lunar radii 1737.4/1737.4/1737.4 km. DE441 is the target/center dynamical source. The manual specifies mean-Earth DE421 lunar surface coordinates, consistent with [PGDA’s MOON_ME / DE421 terrain documentation](https://pgda.gsfc.nasa.gov/products/90). Previous metadata conflated this surface frame with DE441; it now distinguishes them. No arbitrary frame transformation was introduced. No independent sub-meter DEM registration claim is made.

| Scenario / target | First UTC sample | Reference azimuth | Reference elevation | App minus ref az/el (°) |
|---|---|---:|---:|---|
| nobile36 / earth | 2026-11-06T00:00:00Z | 312.200795937 | -1.189156341 | +0.000004063 / -0.000043659 |
| nobile36 / sun | 2026-11-06T00:00:00Z | 170.701023503 | -3.178755265 | -0.000023503 / -0.000044735 |
| degerlache492 / earth | 2026-11-06T00:00:00Z | 93.736231571 | -4.474269991 | -0.000031571 / -0.000030009 |
| degerlache492 / sun | 2026-11-06T00:00:00Z | 312.473258598 | 2.522244797 | +0.000041402 / -0.000044797 |
| haworth492 / earth | 2026-11-06T00:00:00Z | 10.624221638 | -2.281899274 | -0.000021638 / -0.000000726 |
| haworth492 / sun | 2026-11-06T00:00:00Z | 229.289221548 | 0.119927033 | -0.000021548 / -0.000027033 |

Across all 18 reference rows: maximum absolute azimuth difference 0.000041402°, elevation difference 0.000047245°. These are consistent with the app’s four-decimal output rounding. This validates client settings/parsing against NASA, not an independent orbit integration: both clients ultimately use Horizons. Full reference inputs, values and differences are in `references.json`.

## Independent terrain and observer checks

The independent checker uses spherical forward-geodesic rays, the raster CRS transformer and separately indexed terrain pixels, then full Cartesian terrain-minus-observer vectors projected onto local up and horizontal. This differs from the application’s straight projected rays and nominal distance/R curvature calculation. Both use the same measured DEM, so this is a geometry/implementation cross-check, not an independent terrain survey. All sampled pixels were finite and unmasked.

| Scenario | Maximum skyline difference across 360° | RMS difference | Independent Earth hours | Independent Sun hours |
|---|---:|---:|---:|---:|
| nobile36 | 0.230103° | 0.018602° | 0.000000 | 0.000000 |
| degerlache492 | 0.024202° | 0.003057° | 0.000000 | 0.000000 |
| haworth492 | 0.041367° | 0.007207° | 137.431977 | 0.000000 |

The nonzero discrepancies expose the retained projection/ray and pixel-selection approximation; they are not a convergence proof or a universal error bound. Independent geodesic clearances still remain negative for every zero case (see `terrain-independent.json`), with substantially larger margins than these measured skyline differences. Full production and independent skylines are saved in `*-skyline.json`.

Mast altitude is ground DEM elevation + mast above the 1,737.4 km sphere, divided by 1000 for Horizons km. The signed below-datum heights are retained: the datum sphere is not a second physical occluder. At all three positions, the actual elevations differ substantially from hardcoded preset approximate elevations (Nobile 1420 m, de Gerlache −320 m, Haworth −180 m). In particular Haworth’s actual DEM ground is −3484.79 m. The naming “rim” therefore needs independent geographic confirmation; the engine uses the numeric coordinates and actual DEM, not the descriptive preset height. No evidence here establishes these points as certified landing/rim sites.

## Finite-disk audit

Classifications and duration conservation were tested against the implemented thresholds: Earth mean radius 0.95°, Sun mean radius 0.267°. Independent Horizons quantity-13 angular diameters, converted from arcseconds to angular radius degrees, give:

| Scenario | Earth sampled radius range | Sun sampled radius range |
|---|---|---|
| nobile36 | 0.93176 … 0.94405° | 0.26930 … 0.26952° |
| degerlache492 | 0.90897 … 1.01644° | 0.26930 … 0.26958° |
| haworth492 | 0.90910 … 1.01661° | 0.26930 … 0.26958° |

These vary with time; the constants are approximations, not exact disk models. Every zero-sunlight baseline is also fully blocked under the app’s finite-disk classification, with negative clearances well beyond the sampled solar limb radius. This supports the zero cases but does not validate accurate partial-disk illumination: a single-azimuth skyline and fixed mean radius omit disk integration and skyline variation across the disk. Haworth Earth disk durations are 102.8386 h fully visible, 53.4623 h partial-limb, and 335.6991 h fully blocked; these are distinct from center-visibility duration and retain the approximation.

## Sensitivity experiments

Each variant changes only the named setting. Mast variants re-query Horizons at the new height. Search radius and azimuth variants reuse matching cached ephemerides. Time variants request new real NASA series. Shifted dates add 14 days to both endpoints. Results below are Earth % / Sun %; raw hours, inputs and clearance ranges are in `sensitivity.json` and per-run files.

| Variant | Nobile 36 h | de Gerlache 492 h | Haworth 492 h |
|---|---|---|---|
| baseline | 0.00 / 0.00 | 0.00 / 0.00 | 27.93 / 0.00 |
| mast20m | 0.00 / 0.00 | 0.00 / 0.00 | 28.05 / 0.00 |
| mast100m | 0.00 / 0.00 | 0.00 / 0.00 | 28.54 / 0.00 |
| azimuth0.5deg | 0.00 / 0.00 | 0.00 / 0.00 | 27.95 / 0.00 |
| azimuth5deg | 0.00 / 0.00 | 0.00 / 0.00 | 26.78 / 0.00 |
| radius25km | 0.00 / 0.00 | 0.00 / 0.00 | 43.78 / 27.34 |
| radius100km | 0.00 / 0.00 | 0.00 / 0.00 | 26.57 / 0.00 |
| time10min | 0.00 / 0.00 | 0.00 / 0.00 | 27.93 / 0.00 |
| time6h | 0.00 / 0.00 | 0.00 / 0.00 | 27.93 / 0.00 |
| dates_plus14d | 0.00 / 100.00 | 0.00 / 0.00 | 29.75 / 0.00 |

All baseline zero-sunlight cases survive 10-minute sampling, 0.5° azimuth spacing, 20/100 m masts and 100 km rays. Nobile’s shifted dates produce 100% sunlight, so its initial zero is interval-specific. Haworth’s 25 km calculation omits obstructions included by 50 km and produces 27.34% sunlight; it must not be interpreted as evidence that the longer-radius result is wrong. Haworth Earth visibility changes from 27.93% at 50 km to 26.57% at 100 km, so 50 km is not demonstrated to be fully converged. A 5° azimuth profile changes Earth visibility to 26.78%. All finite-radius results remain conditional.

## Comparison metrics, durations and timeline audit

Haworth center visibility is 137.4330 h, blocked time 354.5670 h, totaling 492 h. Its single visible window is 2026-11-20T18:34:01Z → 2026-11-26T12:00:00Z; displayed timestamps are rounded to seconds, while duration is rounded to 0.0001 h. Percentage 137.433/492×100 = 27.9335…%, reported as 27.93% and rounded by the UI to 27.9%; one-decimal hours give 137.4 h.

Backend recorded-evidence tests independently check sample clearance/boolean consistency, finite-disk classification, window sums, visible+blocked totals and timestamp-duration agreement. A frontend server-render test using the real recorded Haworth response checks that the actual timeline CSS left offset and width match window timestamps/durations and the 492-hour evaluated axis; total bar width matches percentage within rounding. The comparison component uses the same arithmetic and suppresses mismatched evaluated intervals. This is a rendered/code-level graphic check, not a browser pixel/screenshot validation.

## Narrow corrections and flagged prose

- Reproduced and fixed surface-frame metadata: DE421 surface coordinates versus DE441 ephemerides. Updated the provenance explanation using the NASA manual and raw headers. No numerical model changes were warranted by the zero results.
- The comparison’s generic relay-prioritization and ISRU prose was not derived from the selected scenarios. It is now explicitly headed “General mission background — not scenario conclusions”; wording no longer implies validated relay suitability or ice at the selected coordinates.
- Preset names/categories/approximate heights still need a dedicated geographic attribution review. Do not claim these are validated official landing points. No preset coordinates were silently replaced.

## Reproduce and evidence integrity

From the project root:

```powershell
.\backend\.venv\Scripts\python.exe backend/validation/validate_step13.py
```

The default harness reuses saved request-keyed ephemeris caches and raw reference responses, so a repeat reproduces this evidence without new NASA queries. Missing caches trigger live requests. To test future ephemerides, archive the evidence directory first and run against a separate new copy; no automatic cache deletion or undocumented refresh occurs. The reconstructed scenarios are declared explicitly in the script. Live endpoints and raw references may evolve with NASA updates.

Files: `baseline.json`, three full analyses, six direction references, six disk references, `references.json`, `disk-references.json`, `terrain-independent.json`, three skylines, 30 sensitivity summaries, request-keyed cached NASA records and `manifest.json` with hashes and software versions. The direction references are independently configured raw NASA responses; the application cache stores parsed NASA records, not independently signed data.

## Checks and remaining uncertainty

- Full backend suite: **65 passed in 25.98 seconds**, including live NASA tests and five new validation regressions.
- Frontend suite: **7 passed**, including the recorded-response timeline test. TypeScript/Vite production build passed; existing ~734 kB bundle warning remains.
- No broad UI redesign, new scientific model, deployment or GitHub push. All work is within LunaRIDGE-2026; the preserved original was not modified.
- Exact historical Nobile dates and nonreported settings remain unconfirmed. No persistent request history existed to recover them.
- No independent SPICE ephemeris solution, surveyed terrain registration, published error/effective-resolution raster analysis, continuous-time proof, global search-radius convergence or full-disk integration was performed. Eclipse occultations, RF connectivity, electrical generation, permanent-shadow classification and landing safety remain outside this model.

## Separate focused presentation proposal (not implemented)

1. Main finding: “At these coordinates, terrain blocks the Sun throughout the evaluated dates,” with the exact submitted site, UTC bounds and mast beside it. Never label the named region generally dark.
2. Separate Earth and Sun cards: percentages and visible/blocked hours, longest blocked interval, evaluated sample count and explicit coverage status.
3. “Why is this value zero?”: show the real paired maximum clearance, target-elevation and relevant skyline ranges, plus whether the target is below the reference horizontal or blocked by elevated terrain. Zero requires complete sampled coverage; otherwise say unavailable.
4. Scenario-specific comparison: explain the computed difference in Earth hours and sunlight hours for the common evaluated dates, not generic rim/summit claims. Include the search-radius sensitivity warning at Haworth.
5. Engineering View: retain raw trajectories, skyline, clearance, window tables, reference settings, mean-disk limitations, DEM identity and sensitivity evidence. Add scenario export/history in a later scoped change so future browser observations can be reproduced exactly.
