# Scientific results presentation stage

Completed 14 November 2026. Work confined to LunaRIDGE-2026. No backend engine/model changes, new datasets, deployment or GitHub push. The preserved LunaLink prototype was not modified.

## What changed

- A prominent computed mission finding now precedes metrics and separates findings, limitations and operational implications.
- Earth and Sun cards show percentages, visible hours, blocked hours and longest center-blocked interval. Unavailable or incomplete summary data do not become zero percentages. Rounded zero percentages with nonzero visible duration are explicitly distinguished from exact zeros.
- Expandable zero explanations use all available paired sample elevations, skyline elevations and clearances. They distinguish below-horizontal directions, obstruction by terrain above the horizontal and overlapping conditions. Missing/inconsistent diagnostics produce explicit explanations of the limitation rather than invented causes. They do not infer whole-disk blockage from center visibility.
- Evaluated/requested UTC bounds and submitted radius remain visible separately. Haworth includes a clearly labeled prior Step 13 sensitivity warning, not a claim that a new sensitivity experiment was run for current inputs.
- Comparison findings summarize selected-site visibility hours, longest blocked intervals, differences and common evaluated bounds before tables; they avoid a universal winner or unverified geology/relay claims. Invalid or mismatched results do not produce comparison conclusions.
- Time-series charts use actual timestamp axes, more tick spacing, stronger tick contrast and retained source precision. Timeline window placement remains timestamp-based. Window annotations can receive keyboard focus. Disk-state duration totals are separate, expandable and explicitly nonchronological; partial-limb totals are not added to center-visible hours.
- A browser test exposed a native date-input event synchronization issue: a tool edit could update displayed dates without updating the scenario draft. Explicit date input-event handling now updates the draft; regression coverage and real-browser stale-state checks confirm input changes hide previous results. Scenario snapshots and request-generation guards are retained.
- Step 13 report placeholders were replaced by actual maxima from the saved 18-row reference evidence: azimuth **0.000041402°**, elevation **0.000047245°**. Its five-column independent-terrain table delimiter was also corrected. Raw evidence and reproducibility files were preserved.

## All changed source, test and documentation files

| File | Purpose |
|---|---|
| `frontend/src/components/ScientificResults.tsx` (new) | Findings, validated summary guards, zero diagnostics, comparison conclusions and radius notices |
| `frontend/src/components/MissionExplorer.tsx` | Compose the new result view; native date-input event handling |
| `frontend/src/App.tsx` | Pass submitted search radius to the result view |
| `frontend/src/components/LandingSiteComparison.tsx` | Scenario-specific findings and warnings before tables; reject incomplete summaries; clearer pending text |
| `frontend/src/components/TimelineBar.tsx` | Missing-data guard, keyboard annotations, disk-state explanation and responsive text |
| `frontend/src/components/ElevationChart.tsx` | Numeric UTC axis, tick spacing/contrast, precision preservation and actual disk-state tooltip labels |
| `frontend/src/components/ClearanceChart.tsx` | Numeric UTC axis, tick spacing/contrast and precision preservation |
| `frontend/src/components/HorizonAzimuthChart.tsx` | More spacing for azimuth tick labels |
| `frontend/src/index.css` | Finding/card/disclosure styling, responsive timeline layout and focus cues |
| `frontend/tests/results.test.mjs` (new) | Real recorded fixtures: findings, zero causes, unavailable/inconsistent data, comparison limits and Haworth warnings |
| `frontend/tests/explorer.test.mjs` | Updated complete fixture; native input-event regression |
| `docs/SCIENTIFIC_VALIDATION_STEP13.md` | Replace numeric placeholders and fix table formatting |
| `docs/RESULTS_PRESENTATION_REPORT.md` (new) | This report |

New browser captures:

- `docs/results-qa/haworth-desktop.jpg`: final 492-hour Haworth results, expanded zero diagnostics.
- `docs/results-qa/haworth-mobile.jpg`: final 390 px stacked result layout.
- `docs/results-qa/comparison.jpg`: actual de Gerlache/Haworth comparison finding.
- `docs/results-qa/engineering.jpg`: Engineering View chart QA capture.
- `docs/results-qa/results-overview.jpg`: result hierarchy during QA.

## Test results

- Complete backend suite: **65 passed in 19.21 seconds**, including existing live NASA integration tests. No Python files were changed.
- Complete frontend suite: **9 passed**. New assertions cover recorded zero results below/above the horizontal, missing/incomplete diagnostics and metrics, percentages below display precision, ties, mismatched evaluated intervals, computed comparison differences, radius-warning scope and native date input events. Existing UTC, request-generation, scientific-label and timestamp-based timeline tests remain passing.
- TypeScript + Vite production build: **passed**. Main bundle about **746 kB**, with the existing >500 kB warning. Parallel server-render tests also emitted nonfatal shared Vite WebSocket-port warnings; assertions passed.

## Real browser QA

The in-app browser connected successfully to the local Vite app and live backend. No fabricated responses were injected.

- Ran the explicit Haworth 2026-11-06 00:00 → 2026-11-26 12:00 UTC scenario: displayed 27.9% Earth visibility, 137.4 visible hours, 354.6 blocked/longest-blackout hours and zero Sun-center visibility across 492 h.
- Opened the zero disclosure: Sun elevation −0.5857° to 3.6488°, paired skyline 4.4170° to 11.0623°, clearance −11.1788° to −1.8265°. Tested Enter to collapse/open the native disclosure.
- Ran actual de Gerlache/Haworth comparison using selected presets: Site B gained 137.4 Earth-visible hours; Sun-center hours were equal at zero. Common UTC bounds and the no-universal-preference statement appeared above the detailed tables.
- Switched back to analysis and into Engineering View. The original clearance chart remained available; chart labels and timestamps were inspected in a screenshot. A large full-DOM chart snapshot timed out once; targeted heading checks and screenshots succeeded.
- Numeric keyboard edits and date input events caused the old results to be hidden with a stale-input status. A fresh explicit-URL scenario was used to reset QA after date-control edits.
- Inspected desktop and 390 × 844 responsive views. Final document width and viewport width both measured **390 px**, with no horizontal overflow. Cards stack, diagnostics wrap, and exact UTC bounds remain readable. Temporary viewport override was reset.

## Remaining limits

This is a presentation and accessibility improvement, not new scientific validation or a new science model. Haworth radius sensitivity, finite sample/ray coverage, approximate disk radii and unverified preset place names remain. No continuous-time guarantees, permanent-shadow classification, RF link budget or electrical-power calculation were added.

Browser QA covers representative successful live scenarios, navigation, disclosures, draft changes and responsive layout; missing/error inputs are regression-tested with fixtures, not every live failure mode. Exhaustive screen-reader, multi-browser, chart-keyboard and delayed-network race testing remains future work. Saved captures reflect the tested states; some Engineering/overview captures were taken during iteration before final tick/card spacing refinements.
