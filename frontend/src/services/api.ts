import {
  AnalysisRequest,
  AnalysisResponse,
  ElevationResponse,
  HorizonProfileRequest,
  HorizonProfileResponse,
} from '../types/api';
import {serialGate} from '../utils/serial';
const analysisSlot=serialGate();

import {apiBase} from '../utils/apiBase';
function endpoint(path: string): string { return apiBase(import.meta.env.VITE_API_BASE_URL) + path; }

class ApiClientError extends Error {
  status?: number;
  detail?: string;
  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text();
    let errorDetail = raw.slice(0, 1000);
    try {
      const data = JSON.parse(raw);
      const detail = data.detail || data.error || data;
      errorDetail = typeof detail === 'string' ? detail : JSON.stringify(detail);
    } catch { /* Plain-text host failures still produce an actionable error. */ }
    const retry = res.headers.get('Retry-After');
    if (retry && (res.status === 429 || res.status === 503)) errorDetail += ` Retry after ${retry} seconds.`;
    throw new ApiClientError(
      `API error ${res.status}: ${errorDetail || res.statusText}`,
      res.status,
      errorDetail
    );
  }
  return res.json() as Promise<T>;
}

export async function checkBackendHealth(): Promise<{ status: string }> {
  const res = await fetch(endpoint(`/health`), {
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<{ status: string }>(res);
}

export async function runVisibilityAnalysis(
  payload: AnalysisRequest, signal?:AbortSignal
): Promise<AnalysisResponse> {
  const snapshot={...payload};
  return analysisSlot(async()=>{
  if(signal?.aborted)throw new DOMException('Analysis canceled before submission.','AbortError');
  // Once sent, retain the slot until the server reply; aborting fetch would not stop server work.
  const res = await fetch(endpoint(`/api/analyze`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(snapshot),
  });
  return handleResponse<AnalysisResponse>(res);
  });
}

export async function fetchHorizonProfile(
  payload: HorizonProfileRequest
): Promise<HorizonProfileResponse> {
  const res = await fetch(endpoint(`/api/terrain/horizon`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<HorizonProfileResponse>(res);
}

export async function fetchElevation(
  latitude: number,
  longitude: number
): Promise<ElevationResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });
  const res = await fetch(endpoint(`/api/terrain/elevation?${params}`), {
    headers: { Accept: 'application/json' },
  });
  return handleResponse<ElevationResponse>(res);
}

export { ApiClientError };

export async function getMissionAssessment(payload: import('../utils/assessment').MissionEnvelope, signal?: AbortSignal): Promise<import('../utils/assessment').Assessment> {
  const res=await fetch(endpoint(`/api/mission/assessment`),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  return handleResponse<import('../utils/assessment').Assessment>(res);
}
export async function downloadMissionPdf(payload: import('../utils/assessment').MissionEnvelope, signal?: AbortSignal): Promise<Blob> {
  const res=await fetch(endpoint(`/api/reports/pdf`),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  if(!res.ok) await handleResponse(res);
  if(!res.headers.get('content-type')?.includes('application/pdf'))throw new Error('The server did not return a PDF. No file was downloaded.');
  return res.blob();
}
