# Step 15A.1 — mission assessment UX polish

## Delivered

- Profile descriptions explain priorities and that switching profiles changes requirements, not NASA results. Challenging results explain why every profile can still fail. Verdicts show a requirement count, plain-language reasons and priority/secondary rows with icons and text.
- Four labeled sliders expose values; collapsed Advanced Settings preserves exact numeric thresholds and the full rules. Documented defaults and backend assessment rules are unchanged.
- Simple View shows each percentage and longest interruption in its requirement row, with visible/blocked hours in compact result cards. Scientific findings, exact UTC bounds and detailed limitations are disclosed; zero explanations and a clearly labeled Haworth sensitivity disclosure remain. Engineering View retains full cards, charts, windows and provenance; duplicate metric diagnostics are expandable.
- Redundant editing buttons were removed. Date/location/mast shortcuts preserve inputs and focus the exact relevant field. There is no best-site/date search or unimplemented Add to comparison claim.
- Compact timelines retain timestamp-based positions, keyboard-focusable windows and full accessible descriptions; short window identifiers fit mobile bars.

## State investigation and regression protection

Profile and threshold edits already used the separate assessment endpoint. Inspection did not establish that such an edit itself mutated scientific inputs. A reproducible false-stale trigger was raw object/string equality: `2026-11-06T00:00` and `2026-11-06T00:00:00Z` represent the same UTC instant but previously differed. The new scientific identity function explicitly covers all eight modeled inputs and normalizes equivalent UTC text/default settings. Assessment settings stay outside that identity. Export envelopes retain the frozen submitted input representation when science is unchanged.

Tests distinguish requirement/profile edits from changes to every scientific field. A new backend regression forbids analysis/horizon calls during assessment/export and checks updated requirements in actual generated PDF text. PDF generation, scientific calculations and assessment service production code were not modified.

## Validation

- **91 backend tests passed**, including the full live NASA/DEM suite and generated PDF tests.
- **17 frontend tests passed**; TypeScript and production build passed. Existing non-fatal HMR-port messages and large-bundle warning remain (about 756 kB main bundle before gzip).
- Browser used real Haworth inputs: -87.87 latitude, -5.1 longitude; 2026-11-06 00:00–2026-11-26 12:00 UTC; 1 h sampling, 2 m mast, 50 km radius. Underlying values stayed 137.4330 Earth-visible hours, 354.5670 longest Earth interruption, zero Sun-center visibility and 492 h Sun-center blockage.
- All three default profiles remained Challenging, as supported by their actual unmet requirements. Communication Priority with Earth minimum 20% and interruption maximum 360 h became Conditional (2/4 met). Solar Priority with Sun minimum 0% and interruption maximum 500 h became Conditional (3/4 met). Balanced with all four permissive requirements became Favorable (4/4 met), while zero sunlight remained zero. Restoring meaningful Sun thresholds returned Conditional. These were requirement-sensitivity checks, not improved NASA results.
- Real browser PDF download verified: Solar Priority, Conditional, Sun minimum 0%, Sun maximum interruption 500 h, and the unchanged live computed values appeared in the downloaded three-page PDF. Temporary verification copy: ignored `tmp/pdfs/step15a1-browser-current-requirements.pdf`. Existing Step 15A PDF rendering/layout evidence is preserved; the PDF generator was unchanged.
- Date, location preset and mast editing shortcuts focused their intended fields. A changed start date produced Insufficient Data and disabled PDF. Restoring the original UTC instant using minute-only text restored the analysis without rerunning it.
- Keyboard slider Home input and exact `20.1234` input were exercised. Desktop 1280×900 and mobile 390×844 screenshots reviewed; collapsed and expanded controls fit without horizontal overflow. Screenshots: `step15a1-qa/assessment-desktop.png`, `assessment-mobile.png`, `controls-mobile.png`.
- All **89** saved Step 13 evidence files match their recorded hashes. Existing validation fixtures were not edited. Pre-change frontend/source checkpoint: ignored `checkpoints/step15a1-before.zip`.

## Files changed

Frontend: `src/App.tsx`; `src/components/MissionAssessment.tsx`, `MissionExplorer.tsx`, `ControlsPanel.tsx`, `ScientificResults.tsx`, `TimelineBar.tsx`; `src/utils/assessment.ts`, `scenario.ts`; `src/index.css`; `tests/assessment.test.mjs`.

Backend: `tests/test_mission_report.py` only. Documentation: `docs/MISSION_ASSESSMENT_METHODS.md`, this report and the three QA screenshots.

## Remaining limitations

Thresholds are illustrative requirements, not NASA recommendations; permissive requirements can yield a favorable label despite zero visibility. Existing finite-radius/time-sampling uncertainties, Haworth radius sensitivity, and RF/power/landing-safety exclusions remain. Legacy analyses still require the Step 15A provenance field before export. Requirements are not persisted across a page reload. No new search capability, science model, dataset or multi-site feature was added.

Temporary QA servers are stopped after verification. LunaLink was not modified. Nothing was deployed or pushed to GitHub.
