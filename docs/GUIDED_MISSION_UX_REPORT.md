# Guided mission UX — verification report

Completed November 15, 2026 in LunaRIDGE-2026. The source checkpoint was created **before editing** at ignored `checkpoints/guided-ux-before-20261115-141041.zip` (255 files). LunaLink was not modified. No deployment, push, staging, commit, license change or timestamp backdating was performed.

## Working experience

Explore Moon retains the real interactive map and now provides **Discover Recommended Mission Opportunities** with three functional actions: inspect saved evaluated examples, plan a mission and open the bounded Finder. The catalog is a learning path, not an assertion of favorable missions or NASA recommendations. It explicitly states that no saved scenario meets all four example requirements.

Catalog metadata loads from the static host. Full sampled responses load only when an example is opened. No NASA request is issued by the catalog or its builder. The existing health checks and map elevation lookup still run as before; those are not ephemeris calculations.

Opening an example verifies SHA-256, checks complete matching scenario provenance and transfers the exact response into Planner or Compare. Planner explicitly labels the saved evidence and offers **View saved results** and **Recompute live**. Compare labels recorded examples until a user explicitly recomputes. Importing never silently runs the scientific model. A changed scientific draft invalidates its assessment/results as before.

Compare applies its own shared requirements. A catalog verdict can therefore differ from Compare without changing a single NASA value; the import notice explains this. Example requirements are seeded into Planner. Existing profile defaults and assessment rules remain unchanged.

## Exact catalog and scientific scope

All inputs use east-positive longitude, UTC, 2 m mast, 1 h sampling, 1° skyline azimuth spacing and 50 km terrain search radius. Source: pinned NASA LOLA LDEM_80S_80MPP_ADJ.TIF, 80 m, MOON_ME/DE421 surface frame, spherical reference radius 1737400 m; Earth/Sun ephemerides from NASA JPL Horizons.

DEM SHA-256: `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`.

| Recorded example | Coordinates | Exact UTC interval | Earth / Sun visible | Longest Earth / Sun interruption | Example verdict |
|---|---|---|---|---|---|
| Haworth area | -87.87°, -5.1° | 2026-11-06T00:00:00Z → 2026-11-26T12:00:00Z | 27.93% / 0% | 354.5670 h / 492 h | Conditional, 2/4 |
| Nobile area | -85.25°, 53.5° | 2026-11-06T00:00:00Z → 2026-11-07T12:00:00Z | 0% / 0% | 36 h / 36 h | Challenging, 1/4 |
| de Gerlache area | -88.5°, -88.3° | 2026-11-06T00:00:00Z → 2026-11-26T12:00:00Z | 0% / 0% | 492 h / 492 h | Challenging, 0/4 |

These are approximate illustrative area labels, not independently certified crater-rim locations or landing sites. The illustrative catalog requirements are Balanced, Earth ≥20%, sunlight ≥50%, Earth interruption ≤400 h and sunlight interruption ≤24 h. They are configured examples, not universal NASA defaults. The longer 492-hour Nobile case from other development reports was not substituted for the independently validated 36-hour evidence.

`frontend/public/examples/catalog.json` records each exact scenario, requested/evaluated bounds, both summaries and windows, assessment/thresholds, DEM identity, original response hash, baseline-input hash, validation scope and downloadable-response hash. The three response files retain the complete actual samples. Combined static JSON size is 473998 bytes, loaded separately from the JS bundle.

Original Step 13 responses predate current submitted_scenario provenance. The builder explicitly binds their separately recorded exact baseline.json input into that field. It does not modify the original evidence, scientific fields, target samples, classifications, windows or numerical results. Backend regression tests compare every adapted scientific field to its archive and revalidate the assessment with existing rules. The builder is deterministic and tested with all network requests forbidden.

Validation scope remains Step 13's sampled scenarios, independently configured Horizons references and separate geodesic/ECEF terrain checks. It is not new independent validation of arbitrary coordinates/dates, proof of permanent shadow, RF performance, energy generation or landing success. Haworth radius sensitivity and finite sampling/search-radius limitations remain visible.

NASA attribution remains [NASA LRO/LOLA and GSFC PGDA](https://pgda.gsfc.nasa.gov/products/90), **Barker et al. (2023), PSJ 4, 183**, [paper DOI](https://doi.org/10.3847/PSJ/acf3e1), [data DOI](https://doi.org/10.60903/gsfcpgda-lola-spole) and [NASA JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html). Existing licensing and provenance records were not changed.

## Simpler comparison

Simple View leads with an actual percentage-point difference and the shared requirements. It retains the original requirement-set dominance, tie and trade-off findings. Unequal-duration/date comparisons explicitly normalize percentages and never rank raw visible hours.

Each compact result row contains actual area/preset label, coordinates, requested dates, verdict, requirement count, Earth/Sun percentage bars, longest interruptions and pass/fail chips. Editing, renaming, adding, duplicating, reordering, removing and map/date selection remain available; editors start collapsed in Simple View. Relevant controls remain bounded to 2–5 scenarios. Recorded-result labels are cleared when live recomputation starts.

Detailed schedules, exact metric tables, paired elevation/clearance charts, full window tables and provenance remain in Engineering View. No chart implementation or timeline positioning was changed. Desktop measured saved-example rows were approximately 307–326 px high. Mobile uses a readable single column. Requirements can be edited without new NASA science, as before.

## Loading and failures

Disabled buttons now use not-allowed rather than a permanent wait cursor; ordinary buttons use pointer. Small loading indicators appear only on actual pending buttons, with reduced-motion support. Native buttons/details, labels, meters and existing visible focus outlines are retained.

The shared API client distinguishes backend busy/starting, rate limits, NASA upstream failures (including service error metadata), missing DEM/coverage and unreachable/network/CORS failures. Retry-After numeric/date values become understandable delay guidance. No new automatic analysis retry or retry loop was introduced. A failed Planner run offers a real manual Retry analysis action and does not duplicate the empty assessment/result explanation. Existing physical request serialization, cancellation and stale-response ownership remain intact.

The UI advises the Retry-After delay; it does not implement a countdown lockout. Server quotas/admission remain authoritative. Network failures cannot prove whether the host is offline versus blocked by CORS/firewall, so the message states those possibilities accurately. Unknown/missing scientific coverage remains unavailable, never zero.

## Verification

| Check | Result |
|---|---|
| Full backend suite | **133 passed, 0 failed** |
| Full frontend suite | **51 passed, 0 failed** |
| TypeScript + Vite production build | Passed, explicit local-QA API URL |
| New backend regressions | 5: three archived examples, offline deterministic rebuild, Git line-ending protection |
| New frontend regressions | 6: provenance/transfers, static checksums, view separation, comparison fairness, homepage actions, failure categories/no retries |
| Saved validation evidence | All 89 manifest hashes unchanged |
| Scientific/backend checkpoint comparison | Backend app, APIs, shared rules and provenance bytes unchanged |
| Git/read-only release checks | No staged files; ignored checkpoint confirmed; no recognized secret pattern or candidate over 10 MiB |
| Actual PDF download | Three pages; Nobile 36-hour bounds, Challenging verdict, actual metrics and Barker citation verified |

The final build has entry JS 398.94 kB / 115.90 kB gzip, chart chunk 393.37 kB / 112.67 kB gzip and CSS 79.07 kB / 15.12 kB gzip. No oversized-chunk warning. No dependencies or locks changed. Parallel frontend test harnesses still emit intermittent Vite development port-24678 warnings; all tests pass.

The final read-only Git inspection found an existing root repository with commit `0a0588a` (Initial commit). No Git history was changed in this UX stage and the staged diff was empty. The isolated audit helper still uses ignored temporary metadata. Checksum-bound example JSON is marked -text in .gitattributes, preventing Windows Git newline conversion from breaking browser verification; this is separately tested.

### Real browser QA

Tested the built frontend at 127.0.0.1:4173 against a local backend at port 8001, desktop 1440 × 1000 and mobile 390 × 844. Verified homepage actions, checksum-backed Planner import, saved-versus-live labels, exact inputs, 2/3/5-scenario comparison states, capacity limits, collapsed editing, removing placeholders, unequal-duration/tie explanations and retained Engineering charts/windows. All sampled visible enabled buttons had pointer cursors, with no permanent wait cursors. Mobile content width and scroll width both measured 385 px: no horizontal overflow in tested views.

Busy-state QA used an **ignored local test helper occupying the existing admission semaphore**, not fabricated NASA responses or a production code change. Real API admission returned 503 with Retry-After 3. The UI showed the concise message and manual retry. After restoring the normal backend, one explicit retry completed a real NASA Nobile 36-hour analysis (0% Earth, 0% Sun), followed by a real single-scenario PDF download. The normal smoke backend log recorded exactly one successful analysis and one successful PDF download. Before explicit recomputation, imports generated assessment/metadata requests only, not analysis requests.

One browser input command timed out after dispatch; fresh state confirmed successful completion, and no duplicate analysis was sent. The recovered final browser session reported no console errors. Temporary test servers were stopped and the viewport override reset. A formal screen-reader/WCAG audit, physical mobile-device test and broad multi-user host load test were not performed.

Screenshots:

- [Evaluated examples, desktop](guided-ux-qa/examples-desktop.jpg)
- [Final compact comparison, desktop](guided-ux-qa/compare-desktop.jpg)
- [Comparison finding, mobile](guided-ux-qa/compare-mobile.jpg)
- [Comparison cards, mobile](guided-ux-qa/compare-mobile-cards.jpg)
- [Controlled busy response, mobile](guided-ux-qa/busy-mobile.jpg)

## Changed files

Modified:

- `.gitattributes`: preserve exact public example bytes.
- `README.md`: guided flow and reproducible catalog instructions.
- `frontend/src/App.tsx`: guided entry points, recorded Planner state, explicit recompute/manual retry and concise failure state.
- `frontend/src/components/ComparisonWorkspace.tsx`: compact Simple results/difference, collapsed management, recorded labels and preserved Engineering content.
- `frontend/src/components/MissionAssessment.tsx`: current scenario/profile strip and pending PDF indicator.
- `frontend/src/components/MissionExplorer.tsx`: truthful pending analysis indicator.
- `frontend/src/index.css`: compact responsive layouts, pointer/focus/loading styling.
- `frontend/src/services/api.ts`: shared request failures, readable Retry-After and preserved service metadata.
- `frontend/src/utils/comparison.ts`: optional recorded-example presentation state only; dominance/queue calculations unchanged.
- `frontend/src/utils/opportunity.ts`: mark transferred recorded examples without altering scientific snapshots.

Added:

- `frontend/src/components/RecommendedMissions.tsx`, `MissionContext.tsx`.
- `frontend/src/utils/examples.ts`, `requestErrors.ts`.
- `frontend/public/examples/catalog.json`, `haworth492.json`, `nobile36.json`, `degerlache492.json`.
- `scripts/build_example_catalog.py`.
- `backend/tests/test_example_catalog.py`, `frontend/tests/guided-ux.test.mjs`.
- This report and the five JPEG screenshots above.

No scientific engine/API, original Step 13 evidence, existing graph implementations, assessment defaults/formulas, dependencies, licenses or preserved prototype were changed. No old source files were deleted.

## Remaining limits and deliberate scope

Catalog scope is deliberately three independently validated constraint examples; it contains no favorable all-requirements-met example or global optimum. Failure to load or verify examples leads to an informative error/empty state and bounded-search action. Live recomputation depends on NASA, backend availability and DEM coverage. Shared comparison criteria can change verdicts relative to examples, and results remain memory-only until page reload.

Optional local save/restore, comparison PDF and CSV export were **not added**, protecting the existing submission-ready workflow. Single-scenario PDF remains working. Production contact, rights/license decisions, actual HTTPS hosting/capacity acceptance and explicit deployment/publication authorization remain as recorded in Step 16A. Nothing was pushed or deployed.
