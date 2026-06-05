/**
 * CoopLens content script — runs on learninginmotion.uvic.ca
 *
 * Only scores the detail view (when a posting is opened).
 * Table badges removed — they only had title+company context and were misleading.
 *
 * Detail page detected by: no #postingsTable + h1 matches "ID - Title"
 * Description source: .tab-content (full text, ~7000+ chars)
 */

const CL_PANEL_ID = "cl-detail-panel";
const scored      = new Map();

// ── auth ─────────────────────────────────────────────────────────────────────
async function getToken() {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, (r) => resolve(r?.token || null))
  );
}

// ── view detection ────────────────────────────────────────────────────────────
function isDetailView() {
  if (document.querySelector("#postingsTable")) return false;
  const h1 = document.querySelector("h1");
  return h1 && /^\d+\s*-\s*.+/.test(h1.innerText.trim());
}

// ── scraping ──────────────────────────────────────────────────────────────────
function scrapeDetail() {
  const h1Text     = document.querySelector("h1")?.innerText?.trim() || "";
  const idMatch    = h1Text.match(/^(\d+)\s*-\s*(.*)/);
  const posting_id = idMatch?.[1] || "unknown";
  const title      = idMatch?.[2]?.trim() || h1Text;

  const content    = document.querySelector(".tab-content");
  const rows       = [...(content?.querySelectorAll("tr") || [])];
  const orgRow     = rows.find(r => r.innerText.includes("Organization Name"));
  const company_name = orgRow?.querySelector("td:last-child")?.innerText?.trim() || "";
  const description  = content?.innerText?.trim() || title;

  return { posting_id, title, company_name, description };
}

// ── API call via background (avoids mixed-content block) ──────────────────────
async function fetchSingleScore(posting) {
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ type: "SCORE_SINGLE", posting }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || "Score failed"));
      resolve(res.data);
    })
  );
}

// ── score colour ──────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 75) return { bg: "#16a34a", label: "Strong" };
  if (score >= 50) return { bg: "#d97706", label: "Okay" };
  return { bg: "#dc2626", label: "Weak" };
}

// ── panel injection ───────────────────────────────────────────────────────────
function injectDetailPanel(s) {
  document.getElementById(CL_PANEL_ID)?.remove();
  const { bg, label } = scoreColor(s.score_total);

  const panel = document.createElement("div");
  panel.id = CL_PANEL_ID;
  panel.style.cssText = `
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:#111;color:#f4f4f5;border-radius:12px;
    padding:16px 20px;margin:12px 0 16px;
    border:1px solid #27272a;box-shadow:0 4px 16px rgba(0,0,0,0.4);
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <span style="font-weight:700;font-size:13px;color:#a1a1aa">CoopLens</span>
      <span style="background:${bg};color:#fff;border-radius:999px;
        padding:3px 12px;font-size:15px;font-weight:800;">
        ● ${s.score_total}
        <span style="font-size:12px;font-weight:500">${label}</span>
      </span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      ${detailSignal("Stack match", s.score_stack, "Resume ↔ posting overlap")}
      ${detailSignal("Company quality", s.score_company, "Size & funding stage")}
      ${detailSignal("Posting clarity", s.score_clarity, "Salary, bullets, requirements")}
    </div>
  `;

  const h1 = document.querySelector("h1");
  h1?.parentElement?.insertBefore(panel, h1.nextSibling) || document.body.prepend(panel);
}

function detailSignal(label, score, sub) {
  const { bg } = scoreColor(score);
  return `
    <div style="background:#18181b;border-radius:8px;padding:10px 12px">
      <div style="font-size:11px;color:#71717a;margin-bottom:4px">${label}</div>
      <div style="font-size:20px;font-weight:800;color:#f4f4f5">${score}</div>
      <div style="height:4px;background:#27272a;border-radius:9999px;margin:6px 0 4px">
        <div style="height:4px;background:${bg};border-radius:9999px;width:${score}%"></div>
      </div>
      <div style="font-size:10px;color:#52525b">${sub}</div>
    </div>
  `;
}

// ── main scorer ───────────────────────────────────────────────────────────────
async function scoreDetailView() {
  const token = await getToken();
  if (!token) return;

  const content = document.querySelector(".tab-content");
  if (!content || content.innerText.trim().length < 100) return;

  const { posting_id } = scrapeDetail();
  const existing = document.getElementById(CL_PANEL_ID);
  if (existing?.dataset.postingId === posting_id) return;

  // Loading state
  document.getElementById(CL_PANEL_ID)?.remove();
  const loading = document.createElement("div");
  loading.id = CL_PANEL_ID;
  loading.dataset.postingId = posting_id;
  loading.style.cssText = `
    font-family:sans-serif;background:#111;color:#a1a1aa;border-radius:12px;
    padding:12px 20px;margin:12px 0 16px;border:1px solid #27272a;
    font-size:13px;display:flex;align-items:center;gap:10px;
  `;
  loading.innerHTML = `
    <div style="width:14px;height:14px;border:2px solid #3f3f46;border-top-color:#3b82f6;
      border-radius:50%;animation:cl-spin 0.7s linear infinite;flex-shrink:0"></div>
    CoopLens is scoring this posting…
    <style>@keyframes cl-spin{to{transform:rotate(360deg)}}</style>
  `;
  document.querySelector("h1")?.parentElement?.insertBefore(loading, document.querySelector("h1").nextSibling);

  try {
    const result = await fetchSingleScore(scrapeDetail());
    document.getElementById(CL_PANEL_ID)?.remove();
    injectDetailPanel(result);
    document.getElementById(CL_PANEL_ID).dataset.postingId = posting_id;
    scored.set(posting_id, result);
  } catch (e) {
    document.getElementById(CL_PANEL_ID)?.remove();
    console.warn("[CoopLens] Detail score failed:", e.message);
  }
}

function scoreVisible() {
  if (isDetailView()) scoreDetailView();
}

// ── observer + start ──────────────────────────────────────────────────────────
const observer = new MutationObserver(() => {
  clearTimeout(observer._debounce);
  observer._debounce = setTimeout(scoreVisible, 400);
});

function start() {
  scoreVisible();
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "complete") {
  setTimeout(start, 800);
} else {
  window.addEventListener("load", () => setTimeout(start, 800));
}
