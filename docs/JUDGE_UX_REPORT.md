# Judge-focused UX upgrade

Completed 14 November 2026 in LunaRIDGE-2026. This was a focused frontend update for submission readiness; no Python endpoints, scientific models, datasets, validation evidence or recorded result fixtures were changed. No deployment or GitHub push was performed. LunaLink was not modified.

## Delivered

- Explore Moon now opens directly on the real interactive LOLA map. A compact introduction replaces the tall hero, with a single introductory Plan Mission action. Date/coordinate forms are no longer the default visual focus.
- Navigation separates **Explore Moon → Plan Mission → Results → Compare**. The compact welcome is shown only on Explore. Mission inputs, results, map state and comparison state are retained while navigating.
- A named preset picker is available beside the map and in Simple View planning. Map clicks and keyboard-operable landmark markers still select real coordinates. Manual coordinates are optional, collapsed controls. Preset place names remain explicitly illustrative.
- Plan Mission exposes site and UTC dates first. Existing mast/sampling values remain visible; Engineering View retains advanced settings. Submitted-scenario snapshots and request-generation guards remain intact.
- Step 14 findings, zero explanations, Earth/Sun cards, exact evaluated bounds, radius warnings, charts and limitations are retained. Results has an explicit Edit mission settings action.
- Compare has editable shared UTC dates, named Site A/B preset selectors, an explicit calculation action, and the computed comparison finding near the top. Coordinates/mast inputs and detailed metric tables are expandable. Invalid date ranges disable submission. Valid zero mast heights are preserved.
- Both comparison timelines now reuse the Step 14 TimelineBar, preserving timestamp-based window positioning, accessible window annotations and separate disk-state explanations. Comparison no longer auto-queries Horizons just because its page is opened.

## Changed files

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Four destinations, compact map-first layout, planning/results separation, shared-date comparison integration |
| `frontend/src/components/MissionExplorer.tsx` | Four-step navigation, reusable preset picker, optional manual coordinates |
| `frontend/src/components/InteractiveLunarMap.tsx` | Responsive map viewport and canvas sizing; existing pixel-to-coordinate mapping still measures the actual canvas width |
| `frontend/src/components/LandingSiteComparison.tsx` | Shared date controls, named/controlled presets, explicit submission, invalid-date guard, collapsed details, reused timelines |
| `frontend/src/index.css` | Compact introduction, map/picker grid, progressive disclosure and responsive styling |
| `frontend/tests/explorer.test.mjs` | Updated navigation expectations for four destinations |
| `frontend/tests/judge-workflow.test.mjs` (new) | Preset input preservation, optional coordinates, shared-date/selector availability, invalid-date blocking and default map-first app rendering |
| `docs/JUDGE_UX_REPORT.md` (new) | This report |
| `docs/judge-ux-qa/explore-desktop.jpg` (new) | Final desktop Explore capture |
| `docs/judge-ux-qa/explore-mobile.jpg` (new) | Mobile Explore viewport capture |
| `docs/judge-ux-qa/compare-desktop.jpg` (new) | Desktop comparison capture |
| `docs/judge-ux-qa/compare-mobile.jpg` (new) | Mobile comparison viewport capture |

## Verification

- Complete backend suite: **65 passed in 52.94 seconds**, including live NASA integration tests.
- Complete frontend suite: **12 passed**, including all nine prior tests and three focused workflow tests.
- TypeScript and production build: **passed**. Main bundle is approximately **742 kB**; the existing >500 kB warning remains.
- Parallel frontend SSR checks emitted nonfatal Vite WebSocket-port warnings. Assertions and the production build passed.
- Validation evidence manifest: **zero file hash mismatches**. Recorded science fixtures were not replaced or edited.
- An initial JSX closing-tag error in the comparison disclosure was caught by the build and corrected before browser QA. Optional bookmarking work was not started.

## Actual browser QA

The local frontend was tested against the running backend without injected or invented analysis responses.

1. Verified the compact desktop introduction, four navigation destinations, actual lunar map and preset picker. Most of the lunar map is visible in a 1280 × 720 viewport; the map is the main visual focus. Smaller viewports require some scrolling to see the complete map/footer.
2. Clicked an unmarked terrain point and verified a custom location was selected with real coordinates and a DEM elevation. Then selected Haworth through the preset picker and navigated to Plan Mission without entering coordinates manually.
3. Changed mission end to 2026-11-26 12:00 UTC and submitted the 492-hour Haworth scenario. Results retained the validated 27.9% Earth visibility, 137.4 visible Earth hours, zero Sun-center visibility, paired zero diagnostics and Haworth sensitivity notice.
4. Selected de Gerlache and Haworth in Compare and explicitly ran both. The preserved finding reported 137.4 additional Earth-visible hours at Site B and equal zero Sun-center hours. Opened and closed the technical metric table with Enter.
5. Edited shared comparison dates and verified stale comparison results were hidden. An end date before the start disabled Run Dual Comparison. Restoring the original range restored the matching scenario, and navigating back to Results retained the main result.
6. Switched to Engineering View and verified the terrain angular clearance chart remained accessible.
7. Inspected Explore and Compare at 390 × 844. No horizontal overflow was detected (document width no greater than viewport width). Preset/date controls and navigation remained accessible. Mobile full-page capture failed, so successful viewport captures were saved instead. Temporary viewport override was reset.

The temporary Vite server used for QA was stopped after testing; the user's backend was not stopped.

## Intentionally missing / remaining limits

- **Local scenario bookmarks were deferred** to protect the core workflow before the stated submission deadline. Drafts/results are not promised to survive a page reload.
- **Science Lab and Reports were not added to app navigation.** Existing project reports remain documentation files, not a new in-app reporting/export feature.
- No 3D renderer, global DEM importer, independent date comparison or new dataset integration was added.
- Haworth search-radius sensitivity, approximate finite-disk modeling, time/radial sampling limits and unverified preset geographic names remain scientific limitations, not resolved by the UX update.
- Browser QA covered representative live successful scenarios, keyboard disclosures, date editing, stale-state behavior, invalid dates and responsive views. Exhaustive device, screen-reader and degraded-network race testing remains outside this pass. Existing regression tests continue to cover request-generation guards and missing-data explanations.
- Navigating away from mounted Engineering graphs can emit Recharts zero-size warnings while their parent is hidden. The chart was confirmed visible when returning to Results; these development-console warnings do not represent missing scientific data. Further lifecycle/performance cleanup is deferred.
