# LunaRIDGE

**Radio, Illumination & Direct-to-Earth Geometry Evaluator.** Explore lunar South Pole terrain and evaluate geometric Earth visibility and sunlight over an explicit mission window.

LunaRIDGE responds to **Lunar Landing Site Navigator** in the supplied NASA Space Apps brief. Select a real terrain location, enter UTC dates, analyze, assess your requirements, compare 2–5 scenarios or evaluate up to six bounded site/date candidates. Results include timelines, whole/partial-disk diagnostics, engineering charts, zero-value explanations and a downloadable scientific PDF.

This is geometry-based planning, not landing certification. Earth visibility does not guarantee RF connectivity; sunlight does not calculate electrical power or battery charge. Finite-window darkness does not establish permanent shadow. Missing coverage remains unknown, never zero. Assessment defaults are illustrative editable requirements, not NASA recommendations or mission-success probabilities.

## Run locally

Use Python 3.11 and Node 24.21.0. In the working project root:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe download_dem.py
.\.venv\Scripts\python.exe download_dem.py --verify-only
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Second terminal, from root:

```powershell
cd frontend
npm ci
npm run dev
```

Local API default: http://127.0.0.1:8000. Live Horizons requires internet. `.env.example` templates contain configuration only; never put secrets in public VITE_ variables. Backend settings are process environment variables; the launcher does not automatically load `.env`. See [complete environment/hosting guide](docs/DEPLOYMENT_GUIDE.md).

Production frontend builds require a real HTTPS `VITE_API_BASE_URL`; an unset URL fails the build. For a **local-only** production-like preview set VITE_API_BASE_URL=http://127.0.0.1:8001 and ALLOW_LOCAL_API_BUILD=1, with the matching backend/CORS described in the guide. Never deploy a loopback bundle.

## NASA data and scientific methods

- **NASA JPL Horizons:** Earth (399) and Sun (10), lunar topocentric UTC observer ephemerides, airless apparent azimuth/elevation. The observer altitude is consistent with terrain elevation plus mast height.
- **NASA LRO/LOLA, GSFC PGDA:** adjusted South Pole DEM, archive MOON_ME / DE421 frame, east-positive longitude and north-clockwise azimuth. Lunar south-polar stereographic coordinates use a 1737400 m reference sphere. The retained map is derived color relief, not an optical photograph or real mission illumination map.
- Terrain skyline, paired angular clearance, target-center visibility, finite-disk diagnostics and timestamp-based windows retain the validated engine. Terrain outside the search radius and events between samples remain uncertain; Haworth results are particularly radius-sensitive.

The raw raster is **not in Git**. The downloader obtains the fixed NASA file, checks SHA-256 and metadata and atomically accepts only a complete raster. Pin: 189158392 bytes, 7600 × 7600 float32, 80 m cells; SHA-256 `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. This is the project's fingerprint, not a NASA-signed checksum.

Credit **Barker et al. (2023), The Planetary Science Journal 4, 183**, [paper DOI](https://doi.org/10.3847/PSJ/acf3e1), [data DOI](https://doi.org/10.60903/gsfcpgda-lola-spole), [NASA GSFC product](https://pgda.gsfc.nasa.gov/products/90), and [NASA JPL Horizons](https://ssd.jpl.nasa.gov/horizons/). See [data terms and acquisition](docs/DATA_SOURCES.md), [methods](docs/SCIENTIFIC_METHODS.md), [independent validation](docs/SCIENTIFIC_VALIDATION_STEP13.md) and [assessment rules](docs/MISSION_ASSESSMENT_METHODS.md).

## Features and architecture

React/TypeScript/Vite provides Explore Moon → Plan Mission → Results, Compare and Find Opportunities. FastAPI provides ephemeris, raster/horizon and visibility endpoints, assessment and PDF generation. Root `shared/` contains common rules; backend tests and 89 pinned Step 13 evidence files preserve reproducibility.

API: GET /health, GET|POST /api/ephemeris, GET /api/terrain/elevation, POST /api/terrain/horizon, POST /api/analyze, POST /api/mission/assessment, POST /api/reports/pdf. Local interactive docs: http://127.0.0.1:8000/docs. No scientific endpoints were removed.

Profiles Solar Priority, Communication Priority and Balanced change assessment requirements, not NASA calculations. Requirements-only edits reuse frozen science; changed scientific inputs invalidate export. PDF includes the exact submitted scenario, computed response, current thresholds, evaluated bounds, windows, methods, limitations and citations. Server validates consistency/coverage, not a NASA-signed result attestation.

Compare retains 2–5 independent scenarios and assesses them under shared requirements. Opportunity Finder evaluates at most six selected candidates, not a global optimum. Different-duration visibility percentages are distinguished from raw hours. Existing request serialization and stale-result guards remain. Scenarios are in memory until reload; a canceled active server computation may continue.

## Verify

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --tb=short
.\.venv\Scripts\python.exe download_dem.py --verify-only
.\.venv\Scripts\python.exe -m pip check
cd ../frontend
npm ci
npm test
npm audit
# Set real HTTPS VITE_API_BASE_URL, or explicit local-QA settings, before building.
npm run build
cd ..
backend\.venv\Scripts\python.exe scripts/release_audit.py
```

Backend suite includes real DEM/live NASA tests and deterministic regressions; network availability matters. Frontend tests cover navigation, UTC, asynchronous ownership, assessment/edit freshness, comparison, bounded Finder and release configuration. Browser testing supplements them. Deployment readiness records exact totals, audits and limitations.

## Public release preparation

Netlify static frontend → HTTPS FastAPI service (Render template) → NASA Horizons and a verified persistent LOLA raster. Render root must remain the whole repository because backend needs shared/. Production uses 28 exact hash-locked dependencies, one worker/instance, explicit CORS, a genuine NASA User-Agent contact, bounded workloads/requests, serialized outbound NASA access and verified terrain readiness. Backend production install uses requirements.lock; local development uses requirements.txt / requirements-dev.lock. Public availability and hosting capacity still require target-host acceptance.

Read [Step 16A findings and changed files](docs/STEP16A_DEPLOYMENT_READINESS.md), [deployment guide and future publication commands](docs/DEPLOYMENT_GUIDE.md), and [public submission checklist](docs/PUBLIC_SUBMISSION_CHECKLIST.md). No GitHub push or deployment has been performed. Paid hosting/storage, real hostnames/contact and explicit publication approval remain owner decisions.

## Rights and development provenance

Application code has **no assigned license**. Source/contributor rights must be confirmed before recommending an OSI-approved license. NASA data, dependencies, fonts and application code have separate terms. See [dependency and asset inventory](docs/THIRD_PARTY_NOTICES.md); full frontend notices ship in public/third-party-notices.txt. Unverified unused images are excluded from release; the active favicon is an original primitive SVG. No NASA endorsement, sponsorship or certification is implied.

The pre-event Antigravity prototype remains preserved separately. Continued work stays in this working copy. [Provenance](docs/PROVENANCE.md) and the [prototype manifest](docs/prototype-manifest.json) retain the genuine history. Mentor guidance about early development is owner-reported; formal organizer approval and competition eligibility are not asserted. No fabricated historical commits or development dates.

Stage records: [Step 14](docs/RESULTS_PRESENTATION_REPORT.md), [15A](docs/STEP15A_REPORT.md), [15A.1](docs/STEP15A1_REPORT.md), [15B](docs/STEP15B_REPORT.md), [15C](docs/STEP15C_REPORT.md). Older reports describe their own implementation stage; this README and Step 16A guide describe current release configuration.
