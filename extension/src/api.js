const API_BASE = "http://localhost:8000";
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

export function setToken(token) {
  return new Promise((resolve) => chrome.storage.local.set({ cl_token: token }, resolve));
}

export function clearToken() {
  return new Promise((resolve) => chrome.storage.local.remove(["cl_token", "cl_resume"], resolve));
}

// ── CoopLens API ─────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = await getToken();
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
