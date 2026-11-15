# Scientific correctness stage report

Completed 14 November 2026 in `C:\111111111111\LunaRIDGE-2026`. No redesign, deployment, GitHub push, fabricated Git history or organizer authorization claim was introduced.

## Verified baseline and preservation

All 60 baseline source/data files matched the original by SHA-256 before modification. A second comparison against the preserved manifest found zero original-file mismatches after implementation. The lunar map, comparison page, charts, NASA integrations and existing engine remain in place. No files were edited in `LunaLink`.

## Corrections

| Area | Root cause and result | Main files |
| --- | --- | --- |
| UTC | Naive browser-local parsing and offset rejection shifted dates. Shared frontend UTC parsing and backend aware-UTC normalization now handle offsets and Colombo date crossings. | Schema `ephemeris.py`, `visibility.py`; new `utils/scenario.ts`; controls, charts and timelines |
| Observer altitude | Horizons used zero altitude while terrain used ground plus mast. Both now use DEM ground plus mast relative to the lunar reference radius. | `services/visibility_service.py` |
| Visibility | A reference-sphere cutoff contradicted positive terrain clearance. Center visibility, disk states and window transitions now use the same skyline clearance. Tiny positive clearance is preserved in serialized results. | `services/visibility_service.py` |
| Transitions | The 1%–99% crossing clamp and small-denominator midpoint fallback biased windows. Root interpolation now handles endpoints and small crossing magnitudes. | `services/visibility_service.py` |
| Terrain coverage | Out-of-bounds and NoData samples were discarded or replaced by clear-horizon assumptions. Missing files, partial rays, NoData and raster masks now fail explicitly. No successful unknown-coverage visibility result is produced. | `services/terrain_service.py` |
| Evaluated interval | Requested endpoints could imply unsampled coverage. Actual evaluated bounds are returned with separate requested bounds; fewer than two, out-of-order and out-of-range samples are rejected. | Visibility service, schema and frontend API types |
| Result state | Live input labels could be paired with old results; older responses could overwrite newer ones. Submission snapshots, stale-result hiding and request-generation guards now protect main and dual-site analysis. Elevation previews clear on coordinate changes. | `App.tsx`, `LandingSiteComparison.tsx`, `ControlsPanel.tsx`, map, new scenario utility |
| Skyline chart | Independent hardcoded 2°/50 km settings could disagree with analysis. The chart now uses the submitted resolution, search radius and mast. | `HorizonAzimuthChart.tsx`, `App.tsx` |
| Labels | Zero sunlight implied permanent shadow; geometry implied power/RF contact. Metrics and timelines now describe geometric Earth visibility and sunlight availability, with interval limits. Unsupported alignment-audit claims were removed. | Metric cards, timeline, comparison, provenance modal and schemas |
| GitHub preparation | No root exclusion policy or strong DEM verification existed. Added root `.gitignore`, pinned SHA-256/metadata verification with staged downloads, NASA citations/terms, methods and provenance documentation. | `.gitignore`, downloader, README, `docs/`, data README |

New deterministic backend regression tests were added in `backend/tests/test_correctness_regressions.py`; existing contradictory sphere-cutoff expectations were corrected. Frontend regressions are in `frontend/tests/scenario.test.ts` and `labels.test.mjs`. Reproducing failures were observed for the primary backend defects, UTC/request-generation behavior and rendered shadow/power labels before corrections. Additional edge-case regressions cover masked terrain, evaluated tails and small root crossings.

## Validation

Final complete backend suite: **60 passed in 22.32 seconds**, including live NASA integration checks. Frontend: **4 tests passed** and **TypeScript + Vite production build passed**. The final small-clearance root regression also passed.

The pinned DEM passed SHA-256, byte count and raster metadata verification. The SHA-256 is a prototype reproducibility pin, not a NASA-issued authenticity signature.

Browser interaction testing was not performed. Frontend coverage includes rendered React labels and utility behavior, not full interactive race simulation or drag/touch accessibility tests. Vite retains the approximately 735 kB bundle warning.

## Remaining limits and next stage

These corrections improve consistency; they do not establish mission-grade validity. Independent frame alignment, angular geometry comparison, projection/radial/azimuth/search-radius sensitivity, preset location provenance and full browser interactions remain validation work. Terrain outside the finite search radius and events between samples remain uncertain. No RF, electrical-power, eclipse, thermal or permanent-shadow model has been added. Legacy API keys remain for compatibility and are documented accurately.

Next UI proposal: a Guided Mission Explorer with Simple and Engineering views, explicit submitted UTC scenario/coverage, concise geometric Earth and sunlight summaries, and expandable methods. Preserve existing map/comparison/chart access. Use one independently checked demo scenario; prepare at most 30 seconds of video OR seven slides, following the owner's stated constraints. See `SUBMISSION.md`. Do not present those constraints or mentor guidance as independently verified organizer authorization.

