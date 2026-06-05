// Service worker — handles token relay, auto-refresh, and API fetches

const API_BASE      = "https://cooplens-production.up.railway.app";
const SUPABASE_URL  = "https://qaufwdmqjhospyyecifm.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdWZ3ZG1xamhvc3B5eWVjaWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTk3NTUsImV4cCI6MjA5NjE3NTc1NX0.yyLtq_iqdtPxHeZh87DNRZToTqdEcUepCuUYn9uhGrg";

async function getValidToken() {
  const { cl_token, cl_refresh_token, cl_token_expiry } =
    await chrome.storage.local.get(["cl_token", "cl_refresh_token", "cl_token_expiry"]);

  if (!cl_refresh_token) return cl_token || null;
  if (cl_token_expiry && Date.now() < cl_token_expiry) return cl_token;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: cl_refresh_token }),
    });
    if (!res.ok) {
      await chrome.storage.local.remove(["cl_token", "cl_refresh_token", "cl_token_expiry"]);
      return null;
    }
    const data = await res.json();
    await chrome.storage.local.set({
      cl_token: data.access_token,
      cl_refresh_token: data.refresh_token,
      cl_token_expiry: Date.now() + 55 * 60 * 1000,
    });
    return data.access_token;
  } catch { return cl_token || null; }
}

async function apiFetch(path, options = {}) {
  const token = await getValidToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_TOKEN") {
    chrome.storage.local.get("cl_token", (r) => sendResponse({ token: r.cl_token || null }));
    return true;
  }

  if (msg.type === "GET_RESUME_EMBEDDING") {
    chrome.storage.local.get("cl_resume", (r) => sendResponse({ resume: r.cl_resume || null }));
    return true;
  }

  if (msg.type === "GET_RESUME") {
    chrome.storage.local.get("cl_resume", (r) => sendResponse({ resume: r.cl_resume || null }));
    return true;
  }

  if (msg.type === "SCORE_SINGLE") {
    apiFetch("/score/single", {
      method: "POST",
      body: JSON.stringify({ posting: msg.posting }),
    })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.action.openPopup?.();
  chrome.alarms.create("deadline-check", { periodInMinutes: 360 });
  chrome.alarms.create("token-refresh",  { periodInMinutes: 45 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "token-refresh") {
    await getValidToken(); // silently refreshes if needed
    return;
  }
  if (alarm.name !== "deadline-check") return;
  const { cl_watchlist = [] } = await chrome.storage.local.get("cl_watchlist");
  const now = Date.now();
  for (const item of cl_watchlist) {
    if (!item.deadline) continue;
    const days = Math.ceil((new Date(item.deadline) - now) / 86400000);
    if (days >= 0 && days <= 3) {
      chrome.notifications.create(`deadline-${item.posting_id}`, {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "CoopLens — Deadline approaching!",
        message: `${item.title} at ${item.company_name} closes in ${days === 0 ? "today" : `${days} day${days > 1 ? "s" : ""}`}`,
      });
    }
  }
});
