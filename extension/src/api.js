const API_BASE = "http://localhost:8000";
const SUPABASE_URL = "https://qaufwdmqjhospyyecifm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdWZ3ZG1xamhvc3B5eWVjaWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTk3NTUsImV4cCI6MjA5NjE3NTc1NX0.yyLtq_iqdtPxHeZh87DNRZToTqdEcUepCuUYn9uhGrg";

// ── Supabase auth ────────────────────────────────────────────────────────────

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Google OAuth via PKCE ────────────────────────────────────────────────────

export async function supabaseSignInWithGoogle() {
  const redirectURL = chrome.identity.getRedirectURL("google");
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  const oauthURL =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectURL)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: oauthURL, interactive: true },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          reject(new Error(chrome.runtime.lastError?.message || "Auth cancelled"));
          return;
        }

        const url = new URL(redirectUrl);
        const code = url.searchParams.get("code");
        if (!code) {
          reject(new Error("No authorization code in response"));
          return;
        }

        // Exchange code + verifier for tokens
        try {
          const resp = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": SUPABASE_ANON_KEY,
              },
              body: new URLSearchParams({
                auth_code: code,
                code_verifier: verifier,
              }).toString(),
            }
          );
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error_description || data.msg || "Token exchange failed");
          resolve({ access_token: data.access_token, refresh_token: data.refresh_token });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

export async function supabaseSignIn(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign-in failed");
  return data; // { access_token, refresh_token, user }
}

export async function supabaseSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
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

export async function getMe() {
  return apiFetch("/auth/me");
}

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
