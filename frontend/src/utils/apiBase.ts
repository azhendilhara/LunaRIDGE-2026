/** An API origin, never an arbitrary proxy or a URL containing credentials. */
export function apiBase(value: string | undefined, production = false, allowLocal = false): string {
  const raw = value?.trim() || (production ? '' : 'http://127.0.0.1:8000');
  if (!raw) throw new Error('Set VITE_API_BASE_URL to the HTTPS backend origin before building.');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('VITE_API_BASE_URL must be a valid HTTP(S) origin.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || /YOUR_|REPLACE|example\.invalid/i.test(raw))
    throw new Error('VITE_API_BASE_URL must be an origin without paths, credentials or placeholders.');
  if (url.protocol !== 'https:' && !local) throw new Error('Remote backends must use HTTPS.');
  if (production && local && !allowLocal) throw new Error('A public build cannot use a loopback backend. ALLOW_LOCAL_API_BUILD=1 is only for local QA.');
  return url.origin;
}
