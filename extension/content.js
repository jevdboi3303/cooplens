/**
 * CoopLens content script — runs on learninginmotion.uvic.ca
 *
 * Two modes (same URL, different DOM):
 *   TABLE MODE  — #postingsTable present → batch-score all rows, inject badges
 *   DETAIL MODE — #postingsTable absent, h1 matches "ID - Title" → score full
 *                 description, inject score panel at top of page
 *
 * DOM confirmed via inspection 2026-06-05:
 *   Table:  #postingsTable tbody tr  |  np-apply-btn-{id}  |  cells[3/4] data-totitle
 *   Detail: h1 "258168 - Title"  |  .tab-content  |  tr where td="Organization Name"
 */

const CL_ATTR        = "data-cl-scored";
const CL_PANEL_ID    = "cl-detail-panel";
const scored         = new Map();

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

// ── TABLE MODE scraping ───────────────────────────────────────────────────────
function scrapeCard(card, index) {
  const cells      = card.querySelectorAll("td");
  const applyBtn   = card.querySelector('a[class*="np-apply-btn-"]');
  const idMatch    = applyBtn?.className.match(/np-apply-btn-(\d+)/);
  const posting_id = idMatch ? idMatch[1] : `cl-${index}`;

  const title        = cells[3]?.getAttribute("data-totitle") || cells[3]?.innerText?.trim() || "Unknown Role";
  const company_name = cells[4]?.getAttribute("data-totitle") || cells[4]?.innerText?.trim() || "";
  const positionType = cells[6]?.innerText?.trim() || "";
  const location     = cells[7]?.innerText?.trim() || "";
  const description  = [title, company_name, positionType, location].filter(Boolean).join(". ");

  return { posting_id, title, company_name, description };
}

function getUnscored() {
  return [...document.querySelectorAll("#postingsTable tbody tr")]
    .map((card, i) => ({ card, data: scrapeCard(card, i) }))
    .filter(({ card, data }) => !card.hasAttribute(CL_ATTR) && data.posting_id.length > 0);
}

// ── DETAIL MODE scraping ──────────────────────────────────────────────────────
function scrapeDetail() {
  const h1Text    = document.querySelector("h1")?.innerText?.trim() || "";
  const idMatch   = h1Text.match(/^(\d+)\s*-\s*(.*)/);
  const posting_id = idMatch?.[1] || "unknown";
  const title      = idMatch?.[2]?.trim() || h1Text;

  const content    = document.querySelector(".tab-content");
  const rows       = [...(content?.querySelectorAll("tr") || [])];
  const orgRow     = rows.find(r => r.innerText.includes("Organization Name"));
  const company_name = orgRow?.querySelector("td:last-child")?.innerText?.trim() || "";

  const description = content?.innerText?.trim() || title;

  return { posting_id, title, company_name, description };
}

// ── API calls via background (avoids mixed-content block) ─────────────────────
async function fetchScores(postings) {
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ type: "SCORE_BATCH", postings }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || "Batch score failed"));
      resolve(res.data.scores);
    })
  );
}

async function fetchSingleScore(posting) {
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ type: "SCORE_SINGLE", posting }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || "Single score failed"));
      resolve(res.data);
    })
  );
}

// ── shared score color ────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 75) return { bg: "#16a34a", label: "Strong" };
  if (score >= 50) return { bg: "#d97706", label: "Okay" };
  return { bg: "#dc2626", label: "Weak" };
}

// ── TABLE MODE: badge injection ───────────────────────────────────────────────
function injectBadge(card, s) {
  card.querySelector(".cl-badge")?.remove();
  const { bg, label } = scoreColor(s.score_total);
  const badge = document.createElement("div");
  badge.className = "cl-badge";
  badge.setAttribute("data-cl-badge", "true");
  badge.style.cssText = `
    display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
    border-radius:999px;background:${bg};color:#fff;
    font-size:12px;font-weight:700;font-family:sans-serif;
    cursor:default;position:relative;z-index:10;margin:4px 0;
  `;
  badge.innerHTML = `<span style="font-size:10px">●</span> ${s.score_total} <span style="font-weight:400;opacity:0.85">${label}</span>`;

  const tip = document.createElement("div");
  tip.style.cssText = `
    display:none;position:absolute;z-index:9999;bottom:calc(100% + 6px);left:0;
    background:#111;color:#f0f0f0;border:1px solid #333;border-radius:10px;
    padding:12px 14px;width:220px;font-size:12px;font-family:sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,0.5);pointer-events:none;
  `;
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;font-size:13px">CoopLens Score: ${s.score_total}</div>
    ${signalRow("Stack match", s.score_stack, "How well your resume overlaps this posting.")}
    ${signalRow("Company quality", s.score_company, "Company size and funding stage.")}
    ${signalRow("Posting clarity", s.score_clarity, "Salary, specificity, requirements.")}
  `;
  badge.appendChild(tip);
  badge.addEventListener("mouseenter", () => { tip.style.display = "block"; });
  badge.addEventListener("mouseleave", () => { tip.style.display = "none"; });

  card.setAttribute(CL_ATTR, s.score_total);
  card.style.position = "relative";
  card.prepend(badge);
}

function signalRow(label, score, explanation) {
  const { bg } = scoreColor(score);
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="width:6px;height:6px;border-radius:50%;background:${bg};flex-shrink:0"></div>
      <div style="flex:1">
        <span style="font-weight:600">${label}</span>
        <span style="float:right;font-weight:700">${score}</span>
        <div style="color:#9ca3af;font-size:10px;margin-top:1px">${explanation}</div>
      </div>
    </div>
  `;
}

// ── DETAIL MODE: panel injection ─────────────────────────────────────────────
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
      <span style="
        background:${bg};color:#fff;border-radius:999px;
        padding:3px 12px;font-size:15px;font-weight:800;
      ">● ${s.score_total} <span style="font-size:12px;font-weight:500">${label}</span></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      ${detailSignal("Stack match", s.score_stack, "Resume ↔ posting overlap")}
      ${detailSignal("Company quality", s.score_company, "Size & funding stage")}
      ${detailSignal("Posting clarity", s.score_clarity, "Salary, bullets, requirements")}
    </div>
  `;

  // Insert after h1
  const h1 = document.querySelector("h1");
  h1?.parentElement?.insertBefore(panel, h1.nextSibling) || document.body.prepend(panel);
}

function detailSignal(label, score, sub) {
  const { bg } = scoreColor(score);
  const pct = Math.round(score);
  return `
    <div style="background:#18181b;border-radius:8px;padding:10px 12px">
      <div style="font-size:11px;color:#71717a;margin-bottom:4px">${label}</div>
      <div style="font-size:20px;font-weight:800;color:#f4f4f5">${score}</div>
      <div style="height:4px;background:#27272a;border-radius:9999px;margin:6px 0 4px">
        <div style="height:4px;background:${bg};border-radius:9999px;width:${pct}%"></div>
      </div>
      <div style="font-size:10px;color:#52525b">${sub}</div>
    </div>
  `;
}

// ── TABLE MODE main loop ──────────────────────────────────────────────────────
async function scoreTableView() {
  const token = await getToken();
  if (!token) return;

  const unscoredItems = getUnscored();
  if (!unscoredItems.length) return;

  const BATCH_SIZE = 50;
  const allScores = [];
  for (let i = 0; i < unscoredItems.length; i += BATCH_SIZE) {
    const chunk = unscoredItems.slice(i, i + BATCH_SIZE);
    try {
      const scores = await fetchScores(chunk.map((c) => c.data));
      allScores.push(...scores);
    } catch (e) {
      console.warn("[CoopLens] Batch score failed:", e.message);
    }
  }

  const scoreMap = new Map(allScores.map((s) => [s.posting_id, s]));
  for (const { card, data } of unscoredItems) {
    const s = scoreMap.get(data.posting_id);
    if (s) { injectBadge(card, s); scored.set(data.posting_id, s); }
  }
}

// ── DETAIL MODE main loop ─────────────────────────────────────────────────────
async function scoreDetailView() {
  const token = await getToken();
  if (!token) return;

  // Wait for .tab-content to be populated
  const content = document.querySelector(".tab-content");
  if (!content || content.innerText.trim().length < 100) return;

  // Don't re-score if panel already present for this posting
  const { posting_id } = scrapeDetail();
  const existing = document.getElementById(CL_PANEL_ID);
  if (existing?.dataset.postingId === posting_id) return;

  // Show loading panel
  document.getElementById(CL_PANEL_ID)?.remove();
  const loadingPanel = document.createElement("div");
  loadingPanel.id = CL_PANEL_ID;
  loadingPanel.dataset.postingId = posting_id;
  loadingPanel.style.cssText = `
    font-family:sans-serif;background:#111;color:#a1a1aa;border-radius:12px;
    padding:12px 20px;margin:12px 0 16px;border:1px solid #27272a;
    font-size:13px;display:flex;align-items:center;gap:10px;
  `;
  loadingPanel.innerHTML = `
    <div style="width:14px;height:14px;border:2px solid #3f3f46;border-top-color:#3b82f6;
      border-radius:50%;animation:cl-spin 0.7s linear infinite;flex-shrink:0"></div>
    CoopLens is scoring this posting…
    <style>@keyframes cl-spin{to{transform:rotate(360deg)}}</style>
  `;
  const h1 = document.querySelector("h1");
  h1?.parentElement?.insertBefore(loadingPanel, h1.nextSibling);

  try {
    const posting = scrapeDetail();
    const result = await fetchSingleScore(posting);
    result.posting_id = posting_id;
    document.getElementById(CL_PANEL_ID)?.remove();
    injectDetailPanel(result);
    document.getElementById(CL_PANEL_ID).dataset.postingId = posting_id;
    scored.set(posting_id, result);
  } catch (e) {
    document.getElementById(CL_PANEL_ID)?.remove();
    console.warn("[CoopLens] Detail score failed:", e.message);
  }
}

// ── unified entry point ───────────────────────────────────────────────────────
function scoreVisible() {
  if (isDetailView()) {
    scoreDetailView();
  } else if (document.querySelector("#postingsTable")) {
    scoreTableView();
  }
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
