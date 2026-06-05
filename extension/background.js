// Service worker — handles token relay and API fetches for content script
// (Background can reach http://localhost without mixed-content restrictions)

const API_BASE = "https://cooplens-production.up.railway.app";

async function apiFetch(path, options = {}) {
  const { cl_token } = await chrome.storage.local.get("cl_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cl_token ? { Authorization: `Bearer ${cl_token}` } : {}),
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
  // Set up daily deadline check alarm
  chrome.alarms.create("deadline-check", { periodInMinutes: 360 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
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
