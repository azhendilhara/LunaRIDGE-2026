# Step 15B — multi-scenario comparison

## Delivered

Compare is now a working 2–5 scenario workspace. Each scenario has a descriptive name, independent location, UTC dates, mast, time step, terrain radius and azimuth resolution. Presets, the existing interactive map and manual coordinates are supported. Users can add, duplicate, remove, reorder, copy all current Mission Planner settings, or copy the first scenario's dates. Copies contain inputs, never preloaded NASA results. Comparison edits do not mutate the main planner.

Each analysis has a frozen submitted-input snapshot, its own status and error, and its own assessment. Scientific edits mark only that scenario stale. Renames, reordering, equivalent UTC text and shared requirement changes retain valid science. Missing/incomplete/failed/unverified data never become zero visibility or a favorable label.

Simple View provides the main finding, normalized Earth/Sun bars, interruption durations, requirement indicators and independent UTC timelines. Engineering View replaces the overview bars with per-scenario exact metadata and metric tables, actual DEM elevations, sampling/terrain settings, expandable paired-elevation/clearance charts, complete windows and NASA provenance. Existing charts/timelines/assessment components are reused. Window records stack inside comparison cards to avoid horizontal scrolling.

## Method and state design

The existing `/api/analyze` is called once per selected scenario requiring calculation. One comparison analysis request runs at a time. Logical cancellation invalidates delivery but **does not release the physical queue slot until that request completes**; the synchronous server computation cannot be canceled remotely. Queued canceled/removed jobs are not sent. Version guards reject late success and failure responses, including after unmount. Other scenarios' results stay available.

The existing UTC/scientific identity function covers all eight supported modeled inputs. Browser QA exposed a native datetime-input event issue: text could change without updating React state when only `onChange` was used. Comparison dates now handle both `onInput` and `onChange`, as the validated main planner already does. A regression test verifies the actual event handler changes only the intended scenario before submission. The different-date live runs documented below were repeated **after** this fix.

Shared Solar Priority, Communication Priority or Balanced requirements use the unchanged Step 15A defaults, editable sliders/exact thresholds and backend verdict rules. Assessment calls reuse frozen responses; they do not rerun Horizons or terrain. Only responses accepted by the existing backend consistency/provenance checks enter the verified bars/findings. Missing, stale and inconsistent scenarios are excluded with Insufficient Data. Requirement changes invalidate old assessment displays until the corresponding current response returns.

There is no score or mission-success probability. Visibility percentages are relative to each scenario's own evaluated interval. Longest interruptions are actual modeled hours within that finite interval. Raw visible hours are not ranked across unequal durations. Different-date timelines retain separate actual UTC bounds; overlapping windows are not falsely placed on a common timeline. Different dates/settings describe different opportunities, not a controlled site-only experiment.

A preferred option is highlighted only when **one** fully verified scenario meets a strict superset of every other scenario's passed requirements: for every alternative it passes all requirements that alternative passes, plus at least one additional requirement. All four requirement keys participate; profile priority determines the existing verdict rules rather than introducing new weights. Identical passed requirement sets are ties; other cases are trade-offs. A passed-requirement count alone cannot establish preference. No overall preference is declared while any selected scenario is unverified. This rule is displayed in the workspace and never claims a universally best site.

## Real browser verification

Five real backend analyses were completed using 2 m mast, 1 h sampling, 50 km terrain radius and 1° horizon spacing. The dates below are the actual requested and evaluated UTC bounds; presets remain approximate exploratory coordinates.

| Scenario | Latitude / east-positive longitude | UTC bounds (2026) | Evaluated h | Earth % / visible h | Longest Earth interruption h | Sun % / longest blockage h |
|---|---|---|---:|---:|---:|---:|
| Haworth, original dates | -87.87 / -5.1 | Nov 6 00:00 → Nov 26 12:00 | 492 | 27.93 / 137.4330 | 354.5670 | 0 / 492 |
| de Gerlache | -88.5 / -88.3 | Nov 6 00:00 → Nov 26 12:00 | 492 | 0 / 0 | 492 | 0 / 492 |
| Nobile, short interval | -85.25 / 53.5 | Nov 6 00:00 → Nov 7 12:00 | 36 | 0 / 0 | 36 | 0 / 36 |
| Haworth, short interval | -87.87 / -5.1 | Nov 6 00:00 → Nov 7 12:00 | 36 | 0 / 0 | 36 | 0 / 36 |
| Haworth, later dates | -87.87 / -5.1 | Nov 20 00:00 → Dec 10 12:00 | 492 | 29.75 / 146.3784 | 327.0546 | 0 / 492 |

All five default Balanced assessments were Challenging. Changing shared Earth requirements to minimum 20% and maximum interruption 360 h, retaining Sun minimum 50% / maximum 24 h, made the two 492-hour Haworth scenarios Conditional (2/4 requirements met). The other three stayed Challenging. There was no unique preference across all five. After removing the three alternatives, the same-time-window Haworth/de Gerlache pair showed Haworth preferred **only by configured requirement-set dominance**, with the universal-best disclaimer.

Observed browser checks:

- Added, duplicated and copied inputs through counts 2, 3, 4 and 5; Add/Copy/Duplicate disabled at five. Reordering preserved all five results. Removing down to two preserved the remaining results and disabled Remove at the minimum.
- A map marker changed only its selected scenario to stale, leaving four verified results. Restoring its original coordinates restored five valid records. Map opening focuses/scrolls to the shared map.
- Canceled an in-flight changed-date recalculation: its late response was not accepted and the other four results remained available.
- A real request at latitude -80°, longitude 0°, radius 150 km failed the existing DEM extent check (`Projected coordinates (0.0, 304005.6) are outside DEM extent`). It showed Analysis failed / Insufficient Data, no zero metric, and a retry message. Restoring valid inputs and rerunning only that scenario recovered five verified records.
- Shared requirement edits generated **six assessment requests, zero analysis requests and zero terrain requests** in the isolated QA log interval. Intermediate assessment requests can be canceled/debounced; only the current requirements are displayed.
- Desktop 1280×900 and mobile 390×844 were reviewed. Both modes, independent timelines, charts and stacked engineering windows fit without horizontal page overflow (mobile measured 385 px content within a 390 px viewport).
- Ran the main single-scenario Haworth analysis again: its original inputs were unchanged, assessment completed and Download PDF was enabled. Returning to Compare retained its analyses. Actual PDF content and freshness remain covered by the full backend tests; no new comparison-PDF feature was added.

Saved evidence and screenshots are under `docs/step15b-qa/`:

- `live-five-scenarios.txt`, `live-engineering.txt`, `live-two-scenarios.txt`: real browser DOM records.
- `coverage-failure.txt`, `assessment-only-request-check.json`: failure and request-isolation evidence.
- `comparison-desktop.png`, `comparison-mobile.png`, `comparison-mobile-bars.png`, `engineering-desktop.png`, `engineering-mobile.png`: reviewed browser screenshots.

These are live QA records, not independent scientific revalidation. Step 13's independent validation and saved evidence remain authoritative within their documented scope.

## Automated verification

- Complete backend suite: **107 passed**, including existing live NASA/DEM integration tests and single-scenario PDF tests. New batch assessment tests exercise 2–5 scenarios across all profiles without invoking science, and all four verdict labels without altering real zero sunlight.
- Complete frontend suite: **30 passed**. Tests cover cardinality/limits, add/duplicate/edit/remove/reorder, immutable snapshots, UTC offsets, same/different sites and dates, native date input events, isolated staleness, failed/incomplete data, serial queue/cancellation/supersession/unmount, fair ties/trade-offs/dominance, unequal/overlapping intervals, real percentage bars, timestamp-derived timeline positions and Engineering content. Existing Step 15A/15A.1 regressions remain passing.
- TypeScript + Vite production build: **passed**. Main bundle about 753 kB / 217 kB gzip; the existing large-bundle warning remains. Parallel SSR tests emit a non-fatal HMR-port warning.
- All **89** Step 13 evidence files match their manifest hashes. No scientific fixture was changed.

## Modified files

- New `frontend/src/utils/comparison.ts`: state operations, request validation, bounded/versioned queue and fair comparison findings.
- New `frontend/src/components/ComparisonWorkspace.tsx`: scenario editing, shared assessments, normalized bars, separate Engineering records and reused map/charts.
- `frontend/src/components/LandingSiteComparison.tsx`: preserves the existing import entry point, now forwarding to the multi-scenario workspace.
- `frontend/src/App.tsx`: passes presentation mode and isolates comparison edits from main planner inputs.
- `frontend/src/index.css`: responsive scenario cards, bars, controls and stacked engineering window tables.
- New `frontend/tests/comparison.test.mjs`; updated `frontend/tests/judge-workflow.test.mjs` for the new independently dated interface.
- New `backend/tests/test_comparison_assessment.py`; **no backend production code changed**.
- Root `README.md`, this report and the QA evidence/screenshots above.

Ignored local pre-change checkpoint: `checkpoints/step15b-before.zip` (258,211 bytes). The previous Step 15A/15A.1 checkpoints remain available.

## Remaining limits

Scenarios and requirements live in memory and reset on reload. This workspace serializes its own analysis requests; it is not a server-wide NASA rate limiter. Canceling cannot stop an already running backend computation. Analysis/server availability and the existing assessment diagnostic size limit still apply.

Comparison is geometry-based planning. RF link budgets, electrical energy/battery models, landing certification and automatic best-date/site search are absent. Finite time windows, sampled terrain, fixed approximate disk radii and Haworth radius sensitivity remain material uncertainties. Preset names/coordinates are not certified landing sites. Detailed records provide provenance consistency, not a cryptographic NASA signature. No new dataset, global DEM importer or physical model was introduced.

Temporary QA servers were stopped after verification. The preserved LunaLink prototype was not modified. No deployment or GitHub push was performed.
