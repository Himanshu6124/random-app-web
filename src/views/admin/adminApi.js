import { useEffect, useRef, useState } from 'react';
import { BASE_URL, getAuthHeaders } from '../../services/authService';

const API = `${BASE_URL}/admin/analytics/api`;

export const TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
})();

export async function adminGet(path, params = {}) {
  const q = new URLSearchParams({ tz: TZ, ...params });
  const res = await fetch(`${API}${path}?${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* not json */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** True when the signed-in account may open the dashboard (the server decides). */
export async function checkAnalyticsAdmin() {
  try {
    await adminGet('/ping');
    return true;
  } catch {
    return false;
  }
}

/** Fetches `path` whenever params change, and every `refreshMs` if given. */
export function useAdminData(path, params, refreshMs) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const key = JSON.stringify(params || {});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer = null;
    const load = async (first) => {
      if (first) setState((s) => ({ ...s, loading: true }));
      try {
        const data = await adminGet(path, JSON.parse(key));
        if (alive.current) setState({ data, error: null, loading: false });
      } catch (error) {
        if (alive.current) setState((s) => ({ data: s.data, error, loading: false }));
      }
    };
    load(true);
    if (refreshMs) timer = setInterval(() => load(false), refreshMs);
    return () => { alive.current = false; if (timer) clearInterval(timer); };
  }, [path, key, refreshMs]);

  return state;
}
