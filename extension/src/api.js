const API_BASE = "https://cooplens-production.up.railway.app";
const SUPABASE_URL = "https://qaufwdmqjhospyyecifm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdWZ3ZG1xamhvc3B5eWVjaWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTk3NTUsImV4cCI6MjA5NjE3NTc1NX0.yyLtq_iqdtPxHeZh87DNRZToTqdEcUepCuUYn9uhGrg";

// ── Supabase auth ────────────────────────────────────────────────────────────

export async function supabaseSignIn(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign-in failed");
  return data;
}

export async function supabaseSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign-up failed");
  return data;
}

// ── token storage ────────────────────────────────────────────────────────────

export function getToken() {
  return new Promise((resolve) =>
    chrome.storage.local.get("cl_token", (r) => resolve(r.cl_token || null))
  );
}

export function setToken(access_token, refresh_token = null) {
  const data = { cl_token: access_token };
  if (refresh_token) data.cl_refresh_token = refresh_token;
  // Store expiry 55 minutes from now (tokens last 1 hour)
  data.cl_token_expiry = Date.now() + 55 * 60 * 1000;
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

export function clearToken() {
  return new Promise((resolve) =>
    chrome.storage.local.remove(["cl_token", "cl_refresh_token", "cl_token_expiry", "cl_resume"], resolve)
  );
}

export async function refreshTokenIfNeeded() {
  const { cl_token, cl_refresh_token, cl_token_expiry } = await new Promise(r =>
    chrome.storage.local.get(["cl_token", "cl_refresh_token", "cl_token_expiry"], r)
  );
  if (!cl_refresh_token) return cl_token || null;
  // Refresh if within 5 minutes of expiry or already expired
  if (cl_token_expiry && Date.now() < cl_token_expiry) return cl_token;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: cl_refresh_token }),
      }
    );
    if (!res.ok) { await clearToken(); return null; }
    const data = await res.json();
    await setToken(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return cl_token || null;
  }
}

// ── CoopLens API ─────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = await refreshTokenIfNeeded();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getMe() { return apiFetch("/auth/me"); }

export async function register(faculty = null) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ faculty }),
  });
}

export async function updateFaculty(faculty) {
  return apiFetch("/auth/faculty", {
    method: "PATCH",
    body: JSON.stringify({ faculty }),
  });
}

export async function getKeywordSuggestions() {
  return apiFetch("/insights/keyword-suggestions");
}

export async function getInterviewRate() {
  return apiFetch("/insights/interview-rate");
}

export async function uploadResume(file) {
  const token = await getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/users/resume`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function scoreBatch(postings) {
  return apiFetch("/score/batch", {
    method: "POST",
    body: JSON.stringify({ postings }),
  });
}

export async function recordOutcome(data) {
  return apiFetch("/outcomes/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
