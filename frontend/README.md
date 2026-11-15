# Frontend

Existing React + TypeScript + Vite interface for LunaRIDGE. The map, comparison and scientific charts are retained. See the [root README](../README.md) for complete setup, tests, scientific methods and attribution.

Use Node.js 24+. Run `npm install`, `npm test`, `npm run build`, and `npm run dev`. Optional `VITE_API_BASE_URL` selects the FastAPI backend; the default is `http://127.0.0.1:8000`.

Date/time inputs without offsets explicitly mean UTC. Results are tied to the submitted scenario, hidden when inputs change, and protected against outdated asynchronous responses. The legacy API fields `earth_comm` and `solar_power` represent geometric Earth-center and Sun-center visibility.
