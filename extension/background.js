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

  if (msg.type === "SCORE_BATCH") {
    apiFetch("/score/batch", {
      method: "POST",
      body: JSON.stringify({ postings: msg.postings }),
    })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
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
});
