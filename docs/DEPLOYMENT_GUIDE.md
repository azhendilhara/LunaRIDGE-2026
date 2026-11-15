# Deployment guide — preparation only

Nothing was pushed or deployed. Resolve [release gates](PUBLIC_SUBMISSION_CHECKLIST.md) before Step 16B. Never put passwords/tokens in source, chat, screenshots or remote URLs.

## Architecture and root directory

Netlify serves React/Vite `frontend/dist`. Its public API origin points to one HTTPS FastAPI service. Only the backend calls NASA and reads the verified LOLA DEM. Reports are generated in memory; scenarios are browser-memory state, not a durable server mission library.

Render must use the **repository root** (Root Directory empty), because backend code needs root `shared/` and `data/`. Do not select `backend` as the hosting root: [Render monorepo rules](https://render.com/docs/monorepo-support) exclude files outside that directory. Commands explicitly enter backend. `render.yaml` is a paid, one-instance template with automatic deployment disabled, not an already-created service. The template selects the current `1c-2g` compute ID (1 CPU / 2 GB) and `autoDeployTrigger: "off"`, checked against the [Render Blueprint reference](https://render.com/docs/blueprint-spec). Review current plan/disk costs and limits before authorizing creation.

## Local development

Prerequisites: Python 3.11 and Node 24.21.0. From the working root:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe download_dem.py
.\.venv\Scripts\python.exe download_dem.py --verify-only
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, from root:

```powershell
cd frontend
npm ci
npm run dev
```

The API defaults to loopback port 8000 only for development. Frontend environment files belong in `frontend/`. Backend configuration uses process environment: `serve.py` does not automatically load `.env`. Local uvicorn supports `--env-file .env` with the development lock. `.env.example` templates are public; actual `.env` files are ignored.

## Configuration

| Variable | Location and meaning |
|---|---|
| `VITE_API_BASE_URL` | Frontend production build: real HTTPS backend origin, no path/query/credentials. All `VITE_` values are public JS, never secrets. |
| `ALLOW_LOCAL_API_BUILD` | `1` only for an explicit loopback QA bundle. Never set on Netlify. |
| `LUNARIDGE_ENV` | Backend: development locally; production publicly. Unknown values fail. |
| `CORS_ORIGINS` | Backend: comma-separated exact frontend origins. No production default, wildcards, paths or credentials. Remote origins require HTTPS. |
| `NASA_USER_AGENT` | Backend: LunaRIDGE/0.5.0 plus genuine owner-provided public contact email or HTTPS URL. Production rejects missing/placeholder contact. No contact has been invented. |
| `PORT` | Host-supplied backend port; default 8000. Launcher binds 0.0.0.0. |
| `DEM_PATH` | Root data path by default; persistent deployment `/var/data/LDEM_80S_80MPP_ADJ.TIF`. |
| `DEM_STRATEGY` | existing: verify before startup; download: obtain if missing, then verify. Invalid existing files fail rather than being overwritten. |
| `WEB_CONCURRENCY` | 1. Single worker AND single instance; limits are process-local. |
| `GDAL_CACHEMAX` | Launcher default 64 MiB, not a cap on all process memory. |
| `PYTHON_VERSION` | Render template 3.11.18, a [security release](https://www.python.org/downloads/release/python-31118/). Local tests used 3.11.2; do not deploy that old patch. |

Production policy defaults (not scientific recommendations):

| Setting | Default |
|---|---:|
| MAX_MISSION_HOURS | 720 |
| MAX_SAMPLES | 2000 |
| MAX_TERRAIN_SAMPLES | 1000000 |
| MAX_BODY_BYTES | 4000000 |
| REQUESTS_PER_IP_MINUTE / REQUESTS_GLOBAL_MINUTE | 120 / 600 |
| SCIENCE_PER_IP_MINUTE / SCIENCE_GLOBAL_MINUTE | 12 / 30 |

Time points use conservative ceil(duration / step) + 1 estimation. Terrain budget estimates azimuth rays × radial samples; the typical 1°, 50 km, 80 m profile has 225625 positions. Report/assessment point count is also bounded. Source defines accepted setting ranges. Raising limits requires capacity testing. Expensive work has one shared science/raster slot; PDF/assessment work has two slots. No unbounded computation queue. Oversized workloads return 422, oversized bodies 413, rate limits 429 with Retry-After, busy science slot 503 with Retry-After 3. Existing browser serialization/cancellation is retained; canceling a browser request does not stop active server CPU work.

Launcher disables trust in forwarded headers; rate limiting uses the socket peer. A reverse proxy can group many users under one address, conservatively sharing quotas. Global limits remain effective. Add a verified trusted-proxy policy only after observing the actual host. CORS is not authentication and application quotas are not volumetric DDoS protection. Host edge controls, budget alerts and abuse monitoring remain operational requirements. Do not add replicas/workers without distributed admission/rate control.

## Verified DEM and persistent storage

Recommended template: paid persistent 1 GB disk mounted at `/var/data`, startup strategy download. Render disks are [runtime-only, not available at build/predeploy time](https://render.com/docs/disks). First startup downloads directly from NASA GSFC HTTPS into a unique partial file on that disk, bounds byte count, verifies hash/metadata, and atomically renames. Partial/corrupt data never become accepted terrain. Later starts verify the existing file. Failure prevents readiness and never produces fabricated zero visibility.

Pinned raster: 189158392 bytes (180.4 MiB), 7600 × 7600 float32, 80 m cells, NaN NoData, bounds ±304000 m, lunar spherical south-polar stereographic radius 1737400 m. SHA-256:

```text
82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a
```

This is the project's reproducibility fingerprint, not a NASA-signed checksum. Preserve [Barker et al. citations and NASA source terms](DATA_SOURCES.md). Never commit the raw DEM or bundle it into the static frontend.

Allow space for final plus temporary raster (~361 MiB) and headroom. A disk is not RAM; the uncompressed float32 raster is ~220 MiB. The engine samples windows, but native libraries/caches/arrays also consume memory. Start capacity evaluation with at least 1 GiB RAM, measure peak RSS under worst permitted requests and reduce budgets if necessary. No paid-host load capacity has been certified locally. Verify disk billing, host outbound access, first-download timing and startup deadline. Persistent disks constrain scaling and zero-downtime rollouts; plan a maintenance window. Other filesystem changes remain ephemeral.

Alternative: download into root data during build, include the verified artifact in runtime, and use DEM_STRATEGY=existing. That needs a fresh ~180 MiB transfer per clean build and compatible artifact retention. Never run a build-time download into a runtime-only disk path. Without persistence, runtime files disappear at host restart/redeploy. NASA outages/blocked egress are real failure states; never substitute demo calculations.

## Backend production commands — future use

```sh
# Repository root, real host environment already configured.
cd backend
python -m pip install --require-hashes --only-binary=:all: -r requirements.lock
python serve.py
```

Launcher runs uvicorn main:app with host PORT, one worker, connection concurrency 32 and backlog 64. The health contract stays `{"status":"ok"}` after DEM readiness; missing/invalid terrain prevents startup or returns 503. Startup checks the full hash; health revalidates when path/size/modification stamp changes. Health does not query NASA and is not an upstream-availability promise. API docs remain `/docs`.

Production lock pins 28 packages plus wheel hashes; development lock pins 38 and includes pytest, httpx, pypdf and dotenv. requirements.txt delegates to the dev lock. Runtime does not need fastapi[standard] cloud/CLI tooling. scripts/lock_dependencies.py intentionally pins the tested installed dependency closure and fetches PyPI hashes; lock refresh is a reviewed operation requiring full tests/audits. Linux CPython 3.11 wheel resolution was checked, not execution on Render or on Python 3.11.18. Target-runtime acceptance remains required.

## NASA operational policy

Backend exposes bounded lunar Earth/Sun requests, not arbitrary target/URL forwarding. Transport serializes NASA calls, adds the application User-Agent and caches exact parameter-identical successful responses for five minutes: 16 entries, maximum 2 MB each. No rounding/reuse across different science inputs. Terrain cache has at most 16 profiles. Existing HTTP timeout of 30 seconds, maximum three attempts and 1/2-second exponential delays for transient errors are retained; these are per-attempt network timeouts, not a total response deadline.

NASA 429 creates a service-wide cooldown: at least 60 seconds, respecting numeric or HTTP-date Retry-After up to one day. Retries during cooldown stop before network access. Errors are not cached as successful science. Read the [current JPL fair-use policy](https://ssd-api.jpl.nasa.gov/doc/): serial requests, restrained automation, cache/backoff, genuine contact, best-effort availability. The browser talks to LunaRIDGE, not directly to NASA.

Live Step 16A signature was NASA/JPL Horizons API version **1.2**, while the [documentation page](https://ssd-api.jpl.nasa.gov/doc/horizons.html) advertises 1.3. This mismatch is recorded, not hidden. Transport checks the actually validated JSON signature 1.2 and fails closed on a missing/unreviewed version. Review parser/scientific regressions before changing it. No ephemeris kernel is pinned by the application.

## Netlify — future use

Repository-root netlify.toml: frontend base, npm ci && npm run build, dist publish, Node 24.21.0. Checkout must retain shared/. Set real HTTPS VITE_API_BASE_URL in build environment; rebuild after changes. Never enable local-QA flags publicly. Vite rejects missing, placeholder, insecure remote or loopback public origins.

Build emits `_headers` with CSP restricted to the exact API origin, existing Google font hosts, self scripts/assets and chart-compatible inline styles. It denies framing/objects and sets nosniff, referrer and capability policies. Other static hosts must apply equivalent headers themselves. SPA fallback is in netlify.toml; current UI navigation is in-memory. Vite preview does not enforce Netlify's headers.

PDF is fetched as a blob without cookies. Backend CORS exposes Content-Disposition and Retry-After to the allowed origin. Scientific freshness/coverage checks remain intact. Missing API/data produces existing actionable error states, not invented results. Dependency/license notices are included in public third-party-notices.txt.

## Local production-like QA

Terminal 1, from root:

```powershell
cd backend
$env:CORS_ORIGINS='http://127.0.0.1:4173'
$env:PORT='8001'
.\.venv\Scripts\python.exe serve.py
```

Terminal 2, from root:

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
$env:ALLOW_LOCAL_API_BUILD='1'
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

This tests separate loopback origins with a **development-mode backend**. Genuine contact is still needed for production configuration. Rebuild for real HTTPS before release.

## Verification commands

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --tb=short
.\.venv\Scripts\python.exe download_dem.py --verify-only
.\.venv\Scripts\python.exe -m pip check
cd ../frontend
npm ci
npm test
npm audit
# Set real HTTPS VITE_API_BASE_URL before a public build.
npm run build
cd ..
backend\.venv\Scripts\python.exe scripts/release_audit.py
```

Audit metadata stays in ignored tmp/release-audit.git, never root Git. It checks evidence hashes, Git ignore behavior, large release candidates, token/private-key patterns and personal paths without exposing possible secret values. It stages nothing. Pattern matching is not proof that every possible secret is absent. Review the staged diff again before publication.

## Step 16B — explicit approval required

1. Confirm source/contributor rights, choose a code license and resolve notice-review entries. Provide genuine public contact. Select hostnames and approve paid hosting/storage. Confirm actual portal requirements/deadline; November 15, 2026 is owner-provided.
2. Re-run suites, current advisory scans, evidence/DEM checks and public-URL build. Review source/assets, NASA terms, CSP and inventory.
3. Create an empty GitHub repository through your own account. The following future commands were **not executed in Step 16A**:

```powershell
# Working project root only.
git init -b main
git check-ignore -v backend/.venv/ frontend/node_modules/ data/lunar_dem/LDEM_80S_80MPP_ADJ.TIF checkpoints/ tmp/
git add .
git status --short
git diff --cached --stat
git diff --cached --check
git ls-files --stage
# Review the full staged diff/rights before committing.
git commit -m "Prepare LunaRIDGE mission explorer for public release"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
# Only after explicit permission to publish:
git push -u origin main
```

Use genuine author identity and current time. No backdating or invented historical commits. Preserve PROVENANCE.md, prototype manifest and 89 validation evidence files. Mentor guidance does not establish formal organizer permission.

4. With deployment approval, connect Render to the repository, review costs/settings, configure real contact/CORS and persistent disk. Verify health, NASA connectivity, DEM checksum, first-start deadline, Linux runtime and peak RAM.
5. Connect Netlify, set final HTTPS API origin, build/publish. Add final frontend origin to backend CORS. Check actual response headers/SPA fallback. Do not broadly allow arbitrary preview origins.
6. On the real HTTPS hosts test map → analysis → requirements-only edits → PDF, stale export blocking, Compare, bounded Finder, mobile/keyboard navigation, errors/429/503, citations and report readability. Verify restart persistence and worst-budget load. Local preview cannot certify these host checks.
7. Keep automatic deployment disabled initially; record accepted commit SHA, non-secret configuration, DEM hash and acceptance evidence. Keep the previous accepted version if checks fail. Do not bypass scientific/coverage/checksum guards to meet a deadline.
