# Step 15C — Mission Opportunity Finder

## Delivered scope

The working Opportunity Finder is available from the fifth navigation destination, **Find Opportunities**. It searches selected coordinates or a finite UTC start grid using the existing real `/api/analyze` and `/api/mission/assessment` endpoints. No backend production code or physical calculation changed. There is no composite score, global optimum claim, landing certification, RF model or power/battery model.

Two modes are implemented:

- **I know my dates — find promising sites:** select/deselect the existing South Pole presets and optionally the current Mission Planner/map coordinates. Exact selected coordinates, candidate names and requested windows are available before searching. Preset labels are explicitly approximate, not certified landing sites. Unknown IDs, identical submitted scenarios and oversized sets are rejected rather than silently omitted.
- **I know my site — find promising dates:** choose a preset, copy the current planner/map location or enter coordinates in Advanced Settings. Set earliest start, latest search end and mission duration; start spacing is in Advanced Settings. The exact candidate windows are previewed and results retain a chronological UTC grid. No claim is made to evaluate every possible start time.

Shared profile/threshold controls reuse Step 15A. Results show the verdict, requirement count, actual values versus thresholds, Earth/Sun percentages, longest interruptions, requested/evaluated bounds and explicit unknown/error states. Detailed results reuse the existing timeline, exact Engineering record, paired elevation/clearance charts, complete windows, NASA citations and Haworth sensitivity warning.

## Candidate algorithm and limits

Application limits are deliberately conservative product budgets, **not NASA-published service quotas**:

| Budget | Limit |
|---|---:|
| Selected/generated candidates per run | 1–6 |
| Each mission window | At most 720 hours / 30 days |
| Date-search horizon | At most 90 days |
| Date-mode mission duration | 1–720 hours |
| Candidate start spacing | 1–2160 hours |
| Complete time-grid points per candidate | At most 2,000 |
| Estimated terrain ray samples per candidate | At most 1,000,000 |

Site mode copies the common submitted science settings and dates, overriding only each selected candidate's numeric coordinates. The current-map candidate uses actual planner coordinates, without substituting a named preset. The preliminary latitude/longitude validation is not a DEM coverage certificate: the unchanged backend checks observer lookup, complete sampled ray extent and finite/NoData terrain coverage. Invalid coverage cannot become a verified result.

For date mode, with earliest start `E`, latest end `L`, duration `D` and spacing `S`, candidate `n` has start `E + n*S` and end `E + n*S + D`. There are `floor((L-E-D)/S) + 1` candidates, including only windows wholly contained in the horizon. The count is checked before allocating a candidate array. A seventh candidate produces a useful error; no tail is truncated. Calendar validity is checked before UTC conversion. Leap days, month/year changes and UTC offsets have deterministic regression coverage.

Date grids use whole-second UTC precision. Sampling must divide the requested mission duration exactly, so the endpoint is included. The point budget is the resulting interval count plus one. Terrain work is estimated from the existing inclusive 0–360° azimuth grid (including its endpoint tolerance) times the existing 80 m radial grid. Default 50 km / 1° settings imply **225,625 estimated ray-sample positions** per terrain profile. These positions are not independent terrain measurements and are not a runtime guarantee.

Finder responses additionally require exact requested/evaluated time coverage, the expected number of samples and the complete ordered timestamp grid. Missing/shortened/irregular grids become incomplete, not favorable estimates. Backend Step 15A consistency checks still verify paired geometry, classifications, windows and summaries before results enter the verified set. These are client validation guards around the existing model, not changes to its science. Single-scenario and Step 15B calculations retain their existing behavior.

## Runtime, cache and service behavior

The existing production Horizons client queries Earth and Sun sequentially. It has 30-second per-request timeouts, up to three attempts, and existing 1/2-second retry backoff for transient/rate-limit failures. Terrain profiles are cached in memory by exact latitude, longitude, mast, azimuth spacing and radius. Thus date searches at one unchanged site can reuse the existing skyline. **The production service has no ephemeris cache**; this stage did not introduce approximate direction reuse, interpolation between candidate analyses or fixture-backed live data.

The frontend now serializes analysis submissions across Finder, Compare and Planner within one page. A waiting submission can be logically canceled before HTTP dispatch. Once sent, its physical slot remains occupied until the reply settles: aborting fetch would not stop synchronous server computation. A Finder run also has a bounded/versioned queue, so cancellation stops unsent candidates and rejects late responses. Starting a replacement run cannot bypass the old request's physical slot. Other tabs, processes and direct API clients are not coordinated by this page-local gate.

Progress distinguishes science complete, running, queued, failed/incomplete, canceled/skipped and verified assessments. Retry only failed candidates preserves successful responses and does not automatically loop; it is an explicit user action for the same frozen requests. Changing science/scope inputs stops remaining scheduling and marks the recorded run stale. Changing requirements reassesses existing results without new science. Network retries and terrain work can make a search take several minutes; no completion-time guarantee is offered.

[JPL's current API guidance](https://ssd-api.jpl.nasa.gov/doc/) calls for serial, restrained requests, reuse where practical, error backoff and an application-specific User-Agent with product/contact details. Before public or multi-user operation, the owner must review the full policy, configure a genuine contact identity in the existing transport and provide server-wide request coordination as appropriate. Those deployment configuration gaps were not filled with fabricated contact information. This local feature does not claim full external-service policy compliance. The [Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html) describes the underlying observer API; the app's numerical settings remain unchanged.

## Assessment, tiers and interpretation

All successfully analyzed candidates use the **same current profile and four thresholds**. Defaults and verdict rules remain those in [MISSION_ASSESSMENT_METHODS.md](MISSION_ASSESSMENT_METHODS.md). A requirement edit does not alter NASA results.

Ranking reuses Step 15B's strict passed-requirement-set dominance. Candidate A dominates B only if A passes every requirement B passes and at least one more. Tier 1 is the nondominated set; remove it to obtain tier 2, and continue. A tier is a partial-order grouping, not a score. Same-tier candidates can tie or trade off. Date cards remain chronological instead of being deceptively sorted on raw visible hours.

A unique relative preference requires more than one candidate, complete verified data for every selected candidate, and one strict dominator over every alternative. The label is **Most favorable among evaluated candidates under these requirements**. Missing or failed candidates suppress an overall preference. If none of the verified candidates passes all four requirements after evaluation, the UI explicitly states **No evaluated candidate met all configured requirements**. A relatively preferred candidate can still be Conditional or Challenging; its failed requirements remain visible.

Percentages use each evaluated interval, and interruption hours apply only inside it. Different dates are different opportunities, not a controlled site-only experiment. No raw-hour ranking, mission-success probability, permanent-shadow inference or RF/electrical-energy prediction is made.

## Immutable state and transfers

Each run has a visible UTC run identifier, creation time, immutable candidate requests and an input identity key. Computed responses are recursively frozen in memory. Scientific inputs use the established UTC/scientific identity rules. Old responses and old assessments cannot overwrite a newer run/requirement configuration. Stale results retain their recorded coordinates/bounds and cannot be transferred as current.

Two real actions are implemented:

- **Open in Mission Planner:** transfers the verified request/response plus the selected profile/thresholds, invalidates older main-page response generations and enables the existing PDF workflow after its consistency check. No new analysis is requested.
- **Add to comparison:** appends the verified request/response without replacing other scenarios or calling science. Compare applies its own clearly displayed shared requirements, so its verdict can differ from Finder when criteria differ. Its five-scenario limit is enforced, and the Finder action disables when full.

The main interactive map remains available for selecting a custom coordinate. Finder lists evaluated coordinates rather than adding a separate evaluated-site map overlay. There is no fake overlay, global heatmap or implicit site certification.

## Recorded real searches

All following outputs came from live backend/NASA calls, not fixtures. Common science settings were 2 m mast, 1 h time sampling, 50 km terrain radius and 1° azimuth spacing.

### Three-site search

Requested/evaluated UTC: **2026-11-06 00:00 → 2026-11-26 12:00**, 492 hours.

| Approximate label / coordinates | Earth visibility | Sunlight availability | Longest Earth interruption | Longest sunlight interruption |
|---|---:|---:|---:|---:|
| de Gerlache / -88.5, -88.3 | 0% | 0% | 492 h | 492 h |
| Haworth / -87.87, -5.1 | 27.93% | 0% | 354.5670 h | 492 h |
| Nobile / -85.25, 53.5 | 23.18% | 58.42% | 377.9605 h | 110.2475 h |

Balanced criteria initially used Earth minimum 20%, Sun minimum 50%, Earth interruption maximum 360 h and Sun interruption maximum 24 h. Haworth was Conditional (2/4), Nobile Challenging (2/4) and de Gerlache Challenging (0/4). Haworth and Nobile passed different requirements, so the result was trade-offs with no unique preference.

Changing only the Earth interruption maximum to **400 h** made Nobile Conditional (3/4) and a unique requirement-set dominator over the other two, while Haworth stayed Conditional (2/4). No candidate met all four requirements. The isolated local backend log showed **three assessment requests, zero analysis requests and zero terrain endpoint requests** for this edit. The longer Nobile interval is distinct from Step 13's 36-hour zero-sunlight case; these observations do not establish permanent conditions or independently revalidate the longer case's terrain geometry.

### Three-window date search

Site: Haworth coordinates **-87.87, -5.1**. Search horizon: **2026-11-19 00:00 → 2026-11-23 00:00 UTC**. Mission duration **36 h**, start spacing **24 h**. Default Communication Priority: Earth minimum 70%, Sun minimum 20%, Earth interruption maximum 12 h, Sun interruption maximum 72 h.

| Candidate UTC window | Earth visibility | Sunlight | Longest Earth interruption | Longest sunlight interruption | Verdict |
|---|---:|---:|---:|---:|---|
| Nov 19 00:00 → Nov 20 12:00 | 0% | 0% | 36 h | 36 h | Challenging, 1/4 |
| Nov 20 00:00 → Nov 21 12:00 | 48.43% | 0% | 18.5670 h | 36 h | Challenging, 1/4 |
| Nov 21 00:00 → Nov 22 12:00 | 100% | 0% | 0 h | 36 h | Conditional, 3/4 |

The November 21 start was preferred only among these evaluated candidates under these requirements. No candidate met every requirement. A November 22 start would end after the horizon and was not generated. The UI reports both the grid spacing and every actual requested/evaluated UTC window.

After the final full-grid completeness guards were added, a fresh two-site search (Haworth/Nobile, same 492-hour window) and a fresh two-window date search (November 20/21 starts) also completed with real API responses and verified assessments. Their saved final-guard records confirm the stricter client accepts these complete 493-/37-point responses.

## Browser and regression verification

- Complete backend pytest suite: **107 passed**, including live NASA/DEM tests, all existing assessment verdict cases and actual generated-PDF tests. Backend production code was unchanged.
- Complete frontend suite: **42 passed**. New deterministic cases cover selection/bounds, duplicate and oversized scopes, date containment/UTC offsets/leap days/month/year changes, sample/terrain budgets, missing/irregular time grids, immutable snapshots, partial failures and failed-only retries, cancellation/superseded runs, page-wide serialization, all verdict presentations, ties/trade-offs/dominance and safe/capacity-limited transfers. Existing Step 15A/15B regressions remain passing.
- TypeScript + Vite production build: **passed**. Main bundle about **781 kB / 225 kB gzip**; the existing size warning remains. Some parallel SSR tests emit a non-fatal HMR-port warning.
- Production preview was used for the primary real site/date searches. An initial development dependency-load stall was resolved by refreshing Vite's dependency graph. SSR test caches are now isolated from the development cache; the recovered development build loaded, survived a further focused test run/reload, and performed the final guarded live searches.
- Browser reassessment, site/date transfers into Compare and Planner, retained current requirements and disabled stale transfers were verified. Changing the date horizon marked the recorded results stale; restoring it permitted the exact candidate transfer again.
- Real transferred Nobile report downloaded successfully: **three-page PDF**, containing Balanced / Conditional, 23.18% Earth, 58.42% Sun, the edited `<= 400 h` requirement, 110.2475 h sunlight interruption and exact UTC bounds. Its temporary verification copy is ignored at `tmp/pdfs/step15c-transferred-candidate.pdf`. The PDF generator/layout was unchanged; this stage checked download/content, not a new PDF layout design.
- A separate development cancellation check showed 0 accepted science results and 3 canceled/skipped candidates; no visibility percentages were invented. Partial NASA/DEM failure and failed-only retry behavior were tested deterministically; no deliberate NASA outage was induced for browser QA.
- Desktop **1280×900** and mobile **390×844** controls, summary, chronological grid and cards were inspected. Mobile content measured **385 px** within a 390 px viewport, without horizontal page overflow. The temporary viewport override was reset.
- All **89** Step 13 evidence files match their recorded hashes. Saved validation fixtures and the original LunaLink prototype were not modified.

Evidence under `docs/step15c-qa/` includes the live site/date DOM records, final guarded run records, Planner/Compare transfer records, stale/canceled search records, request-count JSON and six browser screenshots (`site-search-desktop.png`, `site-cards-desktop.png`, `date-search-desktop.png`, `finder-mobile-controls.png`, `date-search-mobile.png`, `date-grid-mobile.png`). These are application integration evidence, not independent NASA/terrain validation beyond [Step 13's documented scope](SCIENTIFIC_VALIDATION_STEP13.md).

## Modified files

- New `frontend/src/utils/opportunity.ts`: bounded candidate generation, budgets, complete-grid checks, immutable runs, runner/progress, dominance tiers and safe transfer helpers.
- New `frontend/src/utils/serial.ts`: physical analysis request slot.
- New `frontend/src/components/OpportunityFinder.tsx`: two-mode workspace, controls, preview, progress, real result cards, details and actions.
- `frontend/src/services/api.ts`: serialized analysis transport with cancellation before dispatch; endpoint/payload unchanged.
- `frontend/src/utils/comparison.ts`: exports the existing dominance rule and supports cancellation of analysis jobs waiting for transport; numerical/ranking behavior unchanged.
- `frontend/src/components/ComparisonWorkspace.tsx`: validated evaluated-candidate import and capacity reporting.
- `frontend/src/components/MissionAssessment.tsx`: receives explicit transferred requirements, retaining existing rules and PDF action.
- `frontend/src/components/MissionExplorer.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`: Finder navigation, handoffs, preserved screens and responsive styles.
- New `frontend/tests/opportunity.test.mjs`; existing `assessment.test.mjs`, `comparison.test.mjs`, `explorer.test.mjs`, `judge-workflow.test.mjs`, `labels.test.mjs`, `results.test.mjs`, `validation.test.mjs` use isolated SSR caches. Navigation expectations were updated in the existing workflow tests.
- Root `README.md`, this report and QA evidence/screenshots. **No backend production file changed.**

Ignored pre-change checkpoint: `checkpoints/step15c-before.zip` (**273,753 bytes**). Previous checkpoints remain available. Temporary QA servers were stopped after verification. No deployment or GitHub push was performed.

## Remaining limitations

Results and search inputs are in memory and reset on reload; there is no persisted run history. Explicit new searches call the real engine again; no ephemeris/result cache was added. Manual failed-only retries make additional requests, while completed candidates are retained. Cancellation cannot stop an already executing server calculation. The serial gate coordinates one page, not multiple tabs/users or direct API callers.

The scope is at most six selected coordinates or stepped windows, never a continuous/global search. New search limits can reject some settings accepted by the general single-scenario engine. Map coordinates linked into the candidate set can make a recorded run stale if the current planner location changes. Finder does not add a separate evaluated-site overlay or a composite opportunity score.

DEM sampling and search radius, approximate fixed disk radii, finite observation windows and Haworth radius sensitivity remain scientific uncertainties. NASA API availability, legacy transport configuration and public-use policy review remain operational concerns described above. Approximate location labels, relative requirements and finite geometry never certify safety, RF communication, electrical energy, battery charging or mission success.
