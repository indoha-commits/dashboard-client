import { getAccessToken } from '../auth/supabase';

const workersEnabled = import.meta.env.VITE_WORKERS_ENABLED !== 'false';

export function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!baseUrl) throw new Error('VITE_API_BASE_URL is not set');
  return baseUrl.replace(/\/+$/, '');
}

export function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function getAuthPortalUrl(): string {
  const url = import.meta.env.VITE_AUTH_PORTAL_URL as string | undefined;
  if (!url) throw new Error('Missing required env var: VITE_AUTH_PORTAL_URL');
  return url;
}

export function redirectToLogin(): void {
  // Hard redirect so the whole app resets.
  window.location.href = getAuthPortalUrl();
}

export async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (!workersEnabled) throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');

  const url = `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const timeoutMs = init?.timeoutMs ?? 20000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...getAuthHeader(),
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401 || res.status === 403) {
      redirectToLogin();
      throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  } catch (e) {
    // If the request timed out or got aborted, force re-login.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('AbortError')) {
      redirectToLogin();
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
