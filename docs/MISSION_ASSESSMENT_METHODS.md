# Geometry-only mission assessment (Step 15A)

The assessment tests user-selected geometric requirements for the exact submitted site and evaluated interval. It does not estimate landing success, safety, RF link reliability, solar electrical output, energy, or battery charge. There is no composite score or success probability.

## Editable planning assumptions

Defaults are stored once in `shared/mission_profiles.json` and shared by the frontend and backend. They are illustrative application defaults, **not NASA recommendations or validated operational requirements**. Users can edit all four values in Results. Selecting another profile resets its defaults. Values are included in the exported report; they do not alter the scientific analysis.

| Profile | Minimum Earth center visibility | Minimum Sun center visibility | Maximum Earth center-blocked interval | Maximum Sun center-blocked interval |
|---|---:|---:|---:|---:|
| Solar Priority | 20% | 70% | 72 h | 12 h |
| Communication Priority | 70% | 20% | 12 h | 72 h |
| Balanced | 50% | 50% | 24 h | 24 h |

A target passes only if its visibility percentage is at least the minimum **and** its longest blocked interval is at most the maximum. Equality passes. Comparisons use the validated response's rounded summary values (percentages to 0.01 percentage points, durations to 0.0001 hours), rather than the shorter display formatting. Percentages must be finite and between 0 and 100; blackout limits must be finite and between 0 and 100,000 hours.

- **Favorable:** both targets pass all four requirements.
- **Conditional:** for Solar/Communication Priority, the priority target passes both requirements while the other does not. For Balanced, exactly one target passes both requirements.
- **Challenging:** a priority-target requirement fails; for Balanced, neither target passes both requirements.
- **Insufficient Data:** missing, stale, incomplete, non-finite or inconsistent input/results prevent an assessment.

These labels are relative to the configured requirements. Setting a minimum to zero explicitly allows no visibility. A blackout limit longer than the evaluated interval can allow full-interval blockage. A favorable label under permissive requirements does not establish operational adequacy. Each actual value, threshold and pass/fail decision remains visible.

### Step 15A.1 presentation and state clarification

Profile descriptions identify the priority target. All three profiles can remain Challenging because switching requirements does not change computed visibility. Rows distinguish priority/secondary requirements and report how many of the four pass. The verdict rules and defaults above are unchanged.

Sliders provide convenient edits rounded to 0.1; Advanced Settings accepts exact numeric thresholds without this rounding. Rendering or opening a slider does not round an existing exact value. Interruption slider ranges cover at least 24 hours, the evaluated interval and the current configured value; exact input retains the full allowed 100,000-hour upper limit. Percent sliders cover 0–100. A profile switch resets that profile's documented defaults.

Scientific identity now compares only the eight modeled inputs, with equivalent UTC instants and omitted default settings normalized. Assessment profile/threshold state is separate. Equivalent date text uses the original submitted representation in the export envelope. Genuine changes to site, dates, mast, time sampling, azimuth resolution or terrain radius still block export. Requirement-only edits reuse the same frozen result and call only the assessment/report endpoints, never the analysis endpoint.

## Consistency and export checks

The additive `submitted_scenario` response field records all normalized submitted settings, including terrain radius. Older responses without it require a backend restart and a fresh analysis. It is a provenance echo, **not a cryptographic attestation or NASA signature**.

Both new endpoints use the same backend assessment rules. The server checks the response status, submitted/draft scenario identity, observer geometry, requested/evaluated times, sample counts and ordered timestamps. It checks finite paired target elevation/terrain horizon/clearance, center visibility, disk and line-of-sight classifications, and recomputes summary/window consistency using the existing visibility service. No new Horizons or terrain calculation is made during assessment/export. Exports require 2–20,000 complete samples. Invalid reports return HTTP 422 with a reason. The frontend cancels outdated assessment/download requests and prevents exporting stale inputs.

This is consistency validation of supplied analysis data, not authentication of arbitrary client-submitted values against NASA. Local users should export the application's own completed analysis responses.

## Report scope

`POST /api/mission/assessment` accepts the submitted scenario, response, current draft and profile/threshold settings. `POST /api/reports/pdf` accepts the same envelope and generates a real PDF attachment. The report freezes that envelope at download initiation and includes its SHA-256 digest, generation time, coordinates/elevations, requested/evaluated UTC bounds, sampling, mast height, terrain settings, summary metrics, requirements, vector timelines, methods, limitations and source citations.

The major-window tables include up to six longest center-visible windows per target, displayed chronologically; they are not a complete listing when more exist. Full/partial disk durations are separately identified and must not be added to center-visible totals. Report pages repeat table headers and have page-numbered footers.

Finite observation windows do not establish permanent shadow. Terrain beyond the configured radius, unresolved terrain and events between samples remain uncertain. The existing sampled center/disk geometry and interpolation assumptions remain unchanged. Haworth's recorded radius sensitivity is explicitly retained; a default-radius result is not proof of convergence. Suggested changes to dates/site/mast are investigations, not validated mission recommendations.

NASA/JPL Horizons supplies target directions; NASA LRO/LOLA-derived terrain supplies skyline geometry. See [scientific methods](SCIENTIFIC_METHODS.md), [Step 13 independent validation](SCIENTIFIC_VALIDATION_STEP13.md), and [data sources and usage terms](DATA_SOURCES.md). The report cites NASA/JPL Horizons, LRO/LOLA and the LOLA/SELENE terrain work and data DOI. Application source licensing remains separate from NASA data terms.
