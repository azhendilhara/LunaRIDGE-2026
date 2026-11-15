# Mission explorer frontend stage

Work confined to LunaRIDGE-2026; no Python code or scientific models changed. No deployment or GitHub push.

## Changes

- `frontend/src/App.tsx`: map-first welcome, Explore → Analyze → Compare navigation, Simple/Engineering modes, explicit analysis submissions, preserved request-generation guards and submitted scenarios. Comparison is mounted lazily and retained when navigating backward. Failed re-runs clear previous results rather than presenting them as current.
- `frontend/src/components/MissionExplorer.tsx`: accessible workflow controls, essential UTC scenario inputs, computed-value result interpretation, evaluated/requested bounds, percentages, blackout durations and keyboard-focus tooltips for six scientific terms.
- `frontend/src/index.css`: navy/teal visual hierarchy, responsive cards, focus outlines, skip link, reduced-motion support and chart label sizing.
- `frontend/src/components/InteractiveLunarMap.tsx`: keyboard-operable preset markers; corrected southern latitude and western meridian display labels. Map engine preserved.
- `frontend/tests/explorer.test.mjs`: rendered navigation destinations, active-step semantics, invalid scenario blocking, real-value interpretation and evaluated interval disclosure. Existing scenario/request-generation and scientific-label tests retained. `labels.test.mjs` disables HMR during server-render tests to avoid port conflicts.

## Behavior and limits

No analysis is started merely by opening the application. The example loads inputs only and is explicitly pending independent validation; no precomputed NASA values are invented or bundled. Existing backend errors are shown as unavailable analysis, including incomplete coverage; no missing measurement is converted to zero.

Simple View exposes the essential controls, summary percentages and durations, and existing timelines. Engineering View retains the original controls, elevation and clearance charts, skyline, metrics, window table, NASA provenance and model limits. Scenario input changes keep old results hidden until recalculated. Comparing two sites retains the existing common-date behavior; independent date comparison and DEM upload were not added.

## Validation

- Full backend suite: **60 passed in 20.66 seconds**, including live NASA integrations.
- Frontend suite: **6 passed** (four existing tests plus two explorer tests).
- TypeScript and Vite production build: passed. The existing approximately 734 kB bundle warning remains.
- Real Chrome preview opened at localhost. Its accessibility tree confirmed the welcome, workflow, mode controls, UTC inputs, map and explicit offline state. Native screenshot capture timed out repeatedly; indexed interaction failed with `coordinate input geometry is unavailable`. The alternative browser connector reported Chrome unavailable. Therefore no screenshots or successful interactive browser-navigation checks are claimed.

Responsive CSS and keyboard semantics are implemented, but mobile visual QA, end-to-end success/error/stale flows and chart readability still require a functioning browser automation/capture session. Automated navigation tests exercise rendered semantics, not a full mounted browser flow. No scientific demo has been independently validated.
