# Step 15A completion report

## Delivered behavior

Results now lead with a geometry-only mission assessment, an editable Solar Priority / Communication Priority / Balanced profile, and four transparent pass/fail requirements. No composite score or success probability is calculated. Missing, stale, incomplete or inconsistent responses show Insufficient Data. Simple View keeps the Step 14 quantitative finding expandable; Engineering View retains existing charts, diagnostics and tables. Metric names distinguish potential communication/charging opportunities from RF connectivity and electrical energy.

Download PDF produces a real, server-generated scientific report from a frozen submitted scenario, computed response and selected requirements. Consistency checks reject invalid exports and expose a reason. The analysis engine is unchanged; its only modification is an additive submitted-input echo. See [assessment methods and defaults](MISSION_ASSESSMENT_METHODS.md).

## Verification

- Complete backend suite: **90 passed**, including live NASA/DEM checks and generated-PDF content/endpoint tests. Network access was enabled for the existing live integration tests.
- Complete frontend suite: **14 passed**; TypeScript and Vite production build passed. Vite retains its existing large-bundle warning; parallel SSR tests can emit a non-fatal HMR-port warning.
- Regression cases cover favorable, conditional, challenging, inclusive thresholds, permissive zero thresholds, missing/incomplete data, stale scenarios, missing provenance, non-finite metadata, mismatched summaries/clearances/classifications/settings, and actual generated PDF text.
- Actual browser: ran a new Haworth analysis at latitude -87.87, longitude -5.1, 2026-11-06 00:00 to 2026-11-26 12:00 UTC, 1-hour sampling, 2 m mast, 50 km radius. Results remained 137.4330 Earth-visible hours, 354.5670 blocked hours and zero Sun-center visibility across 492 hours.
- Default Balanced was Challenging. Editing Earth minimum to 20% and maximum blackout to 360 hours made it Conditional; Sun minimum 50% and maximum blackout 24 hours failed. Permissive Sun thresholds of 0% and 500 hours produced Favorable while the actual zero sunlight remained unchanged and the permissive-threshold warning remained visible. Both priority profiles were also exercised.
- A real Download PDF click saved the live Conditional report. The downloaded bytes were copied to `output/pdf/LunaRIDGE-live-browser-report.pdf`; extracted content confirms the exact edited thresholds, UTC bounds and computed values. All **three pages** were rendered with Poppler and visually inspected: tables, page breaks, vector timelines, citations and footers are readable without clipping. Poppler emitted fallback-font warnings; rendered report text was intact.
- Empty results disabled export. Changing the selected site made results stale, showed Insufficient Data and disabled export. Restoring the exact submitted site restored the verified assessment. Engineering View's detailed charts and window table remained available.
- Desktop and 390px mobile layouts were inspected. Mobile content width was 385px within a 390px viewport. Saved screenshots: `step15a-qa/assessment-desktop.jpg` and `step15a-qa/assessment-mobile.jpg`.

## Changed files

- Shared defaults: `shared/mission_profiles.json`.
- Backend: `main.py`, `requirements.txt`, `app/schemas/visibility.py`, `app/services/visibility_service.py` (input provenance only), new `app/services/mission_assessment.py` and `app/services/mission_report.py`.
- Backend tests: new `tests/test_mission_assessment.py`, `tests/test_mission_report.py`.
- Frontend: `tsconfig.app.json`, `src/App.tsx`, `src/index.css`, `src/types/api.ts`, `src/services/api.ts`, `src/components/MissionExplorer.tsx`, `src/components/ScientificResults.tsx`, new `src/components/MissionAssessment.tsx`, `src/utils/assessment.ts`, `tests/assessment.test.mjs`.
- Documentation/artifacts: root `README.md`, `.gitignore`, this report, `MISSION_ASSESSMENT_METHODS.md`, the two browser screenshots and the live PDF. Generated PDF page previews are under ignored `tmp/pdfs/`.
- A pre-change source checkpoint is retained locally at ignored `checkpoints/step15a-before.zip`.

## Remaining limitations and operating notes

Restart the updated backend, install its updated requirements and rerun older analyses before using assessment/PDF export: older responses lack complete submitted-scenario provenance. The profile defaults are illustrative; mission owners must set meaningful requirements. No settings persistence or multi-site search was added.

Assessment/export checks response consistency, not cryptographic origin. Exports are capped at 20,000 samples and list at most six major windows per target. RF, power, batteries, landing safety and terrain-radius convergence remain outside scope. Haworth radius sensitivity and finite-window limitations remain visible. PDF reports cover one completed scenario; comparison PDF export is not included.

Step 13 saved validation evidence and test fixtures are preserved. No original LunaLink files were modified. No deployment or GitHub push was performed.
