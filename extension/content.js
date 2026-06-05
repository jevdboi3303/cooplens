/**
 * CoopLens content script — detail page scorer
 *
 * Features:
 *  - Score panel with 3 signals
 *  - Keyword gap analysis (resume vs posting skills)
 *  - Shortlist ★ button
 *  - Mark Applied ✓ button
 *  - Quick compare ↔ button
 *  - "Previously viewed" history note
 */

const CL_PANEL_ID = "cl-detail-panel";

// ── auth ──────────────────────────────────────────────────────────────────────
async function getToken() {
  return new Promise(r => chrome.runtime.sendMessage({ type: "GET_TOKEN" }, res => r(res?.token || null)));
}

async function getResume() {
  return new Promise(r => chrome.runtime.sendMessage({ type: "GET_RESUME" }, res => r(res?.resume || null)));
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

  const cellVal = (label) => {
    const row = rows.find(r => r.innerText.includes(label));
    return row?.querySelector("td:last-child")?.innerText?.trim() || "";
  };

  const company_name  = cellVal("Organization Name");
  const division      = cellVal("Division Name");
  const location      = cellVal("Location") || cellVal("City");
  const position_type = cellVal("Position Type");
  const work_term     = cellVal("Co-op Work Term");
  const description   = content?.innerText?.trim() || title;

  // Extract application deadline
  const deadlineRow   = rows.find(r => /deadline|closing|application\s+date/i.test(r.innerText));
  const deadlineRaw   = deadlineRow?.querySelector("td:last-child")?.innerText?.trim() || "";
  const dateMatch     = description.match(/deadline[:\s]+([A-Za-z]+ \d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
  const deadline      = deadlineRaw || dateMatch?.[1] || "";

  return { posting_id, title, company_name, division, location, position_type, work_term, description, deadline };
}

// ── keyword gap analysis ──────────────────────────────────────────────────────
const SKILL_LIST = [
  "python","java","javascript","typescript","c++","c#","go","rust","kotlin","swift","r","scala",
  "react","vue","angular","next.js","node.js","express","django","fastapi","flask","html","css","tailwind",
  "pandas","numpy","scikit-learn","pytorch","tensorflow","keras","spark","sql","postgresql","mysql",
  "mongodb","redis","elasticsearch","aws","gcp","azure","docker","kubernetes","terraform",
  "git","graphql","rest","grpc","kafka","machine learning","deep learning","nlp","data analysis",
  "linux","bash","ci/cd","agile","scrum","figma","excel","tableau","power bi",
];

function extractKeywords(text) {
  const lower = text.toLowerCase();
  return SKILL_LIST.filter(skill => lower.includes(skill));
}

function analyzeGap(resumeSkills, postingText) {
  const postingKeywords = extractKeywords(postingText);
  const resumeLower = (resumeSkills || []).map(s => s.toLowerCase());
  const matches = postingKeywords.filter(k => resumeLower.some(r => r.includes(k) || k.includes(r)));
  const missing = postingKeywords.filter(k => !resumeLower.some(r => r.includes(k) || k.includes(r)));
  return { postingKeywords, matches, missing };
}

// ── storage via background ────────────────────────────────────────────────────
function storageGet(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r));
}
function storageSet(obj) {
  return new Promise(r => chrome.storage.local.set(obj, r));
}

async function addToHistory(entry) {
  const { cl_score_history = [] } = await storageGet("cl_score_history");
  const updated = [{ ...entry, viewed_at: Date.now() },
    ...cl_score_history.filter(e => e.posting_id !== entry.posting_id)].slice(0, 50);
  await storageSet({ cl_score_history: updated });
}

async function getPreviousView(posting_id) {
  const { cl_score_history = [] } = await storageGet("cl_score_history");
  return cl_score_history.find(e => e.posting_id === posting_id) || null;
}

async function isShortlisted(posting_id) {
  const { cl_shortlist = [] } = await storageGet("cl_shortlist");
  return cl_shortlist.some(e => e.posting_id === posting_id);
}

async function toggleShortlist(entry) {
  const { cl_shortlist = [] } = await storageGet("cl_shortlist");
  const exists = cl_shortlist.some(e => e.posting_id === entry.posting_id);
  const updated = exists
    ? cl_shortlist.filter(e => e.posting_id !== entry.posting_id)
    : [{ ...entry, starred_at: Date.now() }, ...cl_shortlist];
  await storageSet({ cl_shortlist: updated });
  return !exists;
}

async function isApplied(posting_id) {
  const { cl_applied = [] } = await storageGet("cl_applied");
  return cl_applied.some(e => e.posting_id === posting_id);
}

async function markApplied(entry) {
  const { cl_applied = [] } = await storageGet("cl_applied");
  if (!cl_applied.some(e => e.posting_id === entry.posting_id)) {
    await storageSet({ cl_applied: [{ ...entry, applied_at: Date.now() }, ...cl_applied] });
  }
}

async function addToWatchlist(entry) {
  const { cl_watchlist = [] } = await storageGet("cl_watchlist");
  if (cl_watchlist.some(e => e.posting_id === entry.posting_id)) return;
  await storageSet({ cl_watchlist: [{ ...entry, added_at: Date.now() }, ...cl_watchlist] });
}

async function isWatchlisted(posting_id) {
  const { cl_watchlist = [] } = await storageGet("cl_watchlist");
  return cl_watchlist.some(e => e.posting_id === posting_id);
}

async function toggleWatchlist(entry) {
  const { cl_watchlist = [] } = await storageGet("cl_watchlist");
  const exists = cl_watchlist.some(e => e.posting_id === entry.posting_id);
  const updated = exists
    ? cl_watchlist.filter(e => e.posting_id !== entry.posting_id)
    : [{ ...entry, added_at: Date.now() }, ...cl_watchlist];
  await storageSet({ cl_watchlist: updated });
  return !exists;
}

function daysUntil(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

async function toggleCompare(entry) {
  const { cl_compare = [] } = await storageGet("cl_compare");
  const exists = cl_compare.some(e => e.posting_id === entry.posting_id);
  if (!exists && cl_compare.length >= 3) return { added: false, full: true, count: cl_compare.length };
  const updated = exists
    ? cl_compare.filter(e => e.posting_id !== entry.posting_id)
    : [...cl_compare, entry];
  await storageSet({ cl_compare: updated });
  return { added: !exists, full: false, count: updated.length };
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchSingleScore(posting) {
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ type: "SCORE_SINGLE", posting }, res => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || "Score failed"));
      resolve(res.data);
    })
  );
}

// ── colour helpers ────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 75) return { bg: "#16a34a", text: "#fff", label: "Strong" };
  if (score >= 50) return { bg: "#d97706", text: "#fff", label: "Okay" };
  return { bg: "#dc2626", text: "#fff", label: "Weak" };
}

function timeAgo(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── panel ─────────────────────────────────────────────────────────────────────
function injectLoadingPanel(posting_id) {
  document.getElementById(CL_PANEL_ID)?.remove();
  const panel = document.createElement("div");
  panel.id = CL_PANEL_ID;
  panel.dataset.postingId = posting_id;
  panel.style.cssText = `
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:#111;color:#a1a1aa;border-radius:12px;
    padding:12px 20px;margin:12px 0 16px;
    border:1px solid #27272a;font-size:13px;
    display:flex;align-items:center;gap:10px;
  `;
  panel.innerHTML = `
    <div style="width:14px;height:14px;border:2px solid #3f3f46;border-top-color:#3b82f6;
      border-radius:50%;animation:cl-spin 0.7s linear infinite;flex-shrink:0"></div>
    CoopLens is scoring this posting…
    <style>@keyframes cl-spin{to{transform:rotate(360deg)}}</style>
  `;
  insertPanel(panel);
}

async function injectFullPanel(s, detail, resume) {
  document.getElementById(CL_PANEL_ID)?.remove();

  const { bg, text, label } = scoreColor(s.score_total);
  const [starred, applied, prevView, watchlisted] = await Promise.all([
    isShortlisted(detail.posting_id),
    isApplied(detail.posting_id),
    getPreviousView(detail.posting_id),
    isWatchlisted(detail.posting_id),
  ]);

  // Keyword gap
  const { matches, missing } = analyzeGap(resume?.skills, detail.description);

  const panel = document.createElement("div");
  panel.id = CL_PANEL_ID;
  panel.dataset.postingId = detail.posting_id;
  panel.style.cssText = `
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:#111;color:#f4f4f5;border-radius:14px;
    padding:16px 20px;margin:12px 0 16px;
    border:1px solid #27272a;
    box-shadow:0 4px 24px rgba(0,0,0,0.5);
  `;

  // Header row
  panel.innerHTML = `
    <style>
      #cl-detail-panel * { box-sizing:border-box; }
      @keyframes cl-pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
    </style>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-weight:800;font-size:12px;color:#52525b;letter-spacing:.05em">COOPLENS</span>
      <span id="cl-score-badge" style="background:${bg};color:${text};border-radius:999px;
        padding:4px 14px;font-size:16px;font-weight:900;letter-spacing:-.3px">
        ${s.score_total} <span style="font-size:11px;font-weight:500;opacity:.85">${label}</span>
      </span>
      ${prevView && prevView.viewed_at !== s.viewed_at ? `
        <span style="font-size:11px;color:#52525b;margin-left:auto">
          Previously scored ${s.score_total} · ${timeAgo(prevView.viewed_at)}
        </span>` : ""}
    </div>

    <!-- Recommendation banner -->
    ${s.recommendation ? `
    <div style="margin-bottom:12px;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:700;
      background:${recBg(s.recommendation)};color:#fff">
      ${recIcon(s.recommendation)} ${s.recommendation}
      ${s.role_archetype ? `<span style="font-weight:400;opacity:.8;margin-left:6px">· ${s.role_archetype}</span>` : ""}
    </div>` : ""}

    <!-- Signal cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      ${signalCard("CV Match", s.score_cv ?? s.score_stack, "Resume ↔ posting")}
      ${signalCard("Company", s.score_company, "Size & funding")}
      ${signalCard("Clarity", s.score_clarity, "Salary, bullets, reqs")}
    </div>

    <!-- Red flags -->
    ${s.red_flags?.length ? `
    <div style="background:#1a0a0a;border:1px solid #3f1515;border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ef4444;margin-bottom:6px">⚠ Red Flags</div>
      ${s.red_flags.map(f => `<div style="font-size:11px;color:#fca5a5;margin-bottom:3px">· ${f}</div>`).join("")}
    </div>` : ""}

    <!-- Keyword gap -->
    <div style="background:#18181b;border-radius:10px;padding:12px;margin-bottom:12px;border:1px solid #27272a">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#52525b;margin-bottom:8px">
        Keyword Analysis
      </div>
      ${matches.length ? `
        <div style="margin-bottom:6px">
          <span style="font-size:10px;color:#22c55e;font-weight:600">✓ Your resume covers</span>
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
            ${matches.slice(0,8).map(k => `<span style="background:#14532d;color:#86efac;padding:2px 8px;border-radius:999px;font-size:10px">${k}</span>`).join("")}
          </div>
        </div>` : ""}
      ${missing.length ? `
        <div>
          <span style="font-size:10px;color:#f97316;font-weight:600">+ Consider adding</span>
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
            ${missing.slice(0,8).map(k => `<span style="background:#431407;color:#fdba74;padding:2px 8px;border-radius:999px;font-size:10px">${k}</span>`).join("")}
          </div>
        </div>` : ""}
      ${!matches.length && !missing.length ? `<span style="font-size:11px;color:#52525b">No specific tech keywords detected in this posting.</span>` : ""}
    </div>

    <!-- Company research card -->
    ${(detail.company_name || detail.division || detail.location) ? `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#52525b;margin-bottom:6px">Company</div>
      <div style="font-weight:700;font-size:13px;color:#f4f4f5;margin-bottom:2px">${detail.company_name}</div>
      ${detail.division ? `<div style="color:#71717a">${detail.division}</div>` : ""}
      ${detail.location ? `<div style="color:#71717a">📍 ${detail.location}</div>` : ""}
      ${detail.work_term ? `<div style="color:#71717a;margin-top:4px">📅 ${detail.work_term}</div>` : ""}
      ${s.company_meta?.size_band ? `<div style="color:#71717a">👥 ${s.company_meta.size_band} employees</div>` : ""}
      ${detail.deadline ? `<div style="margin-top:6px;font-weight:700;color:${daysUntil(detail.deadline) !== null && daysUntil(detail.deadline) <= 3 ? "#ef4444" : daysUntil(detail.deadline) !== null && daysUntil(detail.deadline) <= 7 ? "#f97316" : "#a1a1aa"}">
        ⏰ Deadline: ${detail.deadline}${daysUntil(detail.deadline) !== null ? ` (${daysUntil(detail.deadline)} days)` : ""}
      </div>` : ""}
    </div>` : ""}

    <!-- Action buttons -->
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="cl-btn-star" style="${actionBtnStyle(starred ? "#1e3a5f" : "#18181b", starred ? "#60a5fa" : "#a1a1aa")}">
        ${starred ? "★ Starred" : "☆ Star"}
      </button>
      <button id="cl-btn-watch" style="${actionBtnStyle(watchlisted ? "#1c1917" : "#18181b", watchlisted ? "#fbbf24" : "#a1a1aa")}">
        ${watchlisted ? "🔔 Watching" : "🔔 Watch"}
      </button>
      <button id="cl-btn-apply" style="${actionBtnStyle(applied ? "#14532d" : "#18181b", applied ? "#86efac" : "#a1a1aa")}">
        ${applied ? "✓ Applied" : "✓ Mark Applied"}
      </button>
      <button id="cl-btn-compare" style="${actionBtnStyle("#18181b", "#a1a1aa")}">
        ↔ Compare
      </button>
    </div>
  `;

  insertPanel(panel);

  // Wire buttons
  panel.querySelector("#cl-btn-star").addEventListener("click", async (e) => {
    const nowStarred = await toggleShortlist({ ...detail, score_total: s.score_total });
    e.target.textContent = nowStarred ? "★ Starred" : "☆ Star";
    e.target.style.background = nowStarred ? "#1e3a5f" : "#18181b";
    e.target.style.color = nowStarred ? "#60a5fa" : "#a1a1aa";
  });

  panel.querySelector("#cl-btn-watch").addEventListener("click", async (e) => {
    const nowWatching = await toggleWatchlist({
      ...detail, score_total: s.score_total,
      deadline: detail.deadline,
    });
    e.target.textContent = nowWatching ? "🔔 Watching" : "🔔 Watch";
    e.target.style.background = nowWatching ? "#1c1917" : "#18181b";
    e.target.style.color = nowWatching ? "#fbbf24" : "#a1a1aa";
  });

  panel.querySelector("#cl-btn-apply").addEventListener("click", async (e) => {
    await markApplied({ ...detail, score_total: s.score_total });
    e.target.textContent = "✓ Applied";
    e.target.style.background = "#14532d";
    e.target.style.color = "#86efac";
  });

  panel.querySelector("#cl-btn-compare").addEventListener("click", async (e) => {
    const { added, full, count } = await toggleCompare({ ...detail, score_total: s.score_total });
    if (full) { e.target.textContent = "↔ Full (3/3)"; return; }
    e.target.textContent = added ? `↔ In compare (${count}/3)` : "↔ Compare";
  });
}

function recBg(rec) {
  if (!rec) return "#27272a";
  if (rec.includes("Strong")) return "#16a34a";
  if (rec.includes("Worth"))  return "#2563eb";
  if (rec.includes("Maybe"))  return "#d97706";
  return "#71717a";
}

function recIcon(rec) {
  if (!rec) return "";
  if (rec.includes("Strong")) return "✦";
  if (rec.includes("Worth"))  return "→";
  if (rec.includes("Maybe"))  return "~";
  return "✕";
}

function signalCard(label, score, sub) {
  const { bg } = scoreColor(score);
  return `
    <div style="background:#18181b;border-radius:8px;padding:10px 12px;border:1px solid #27272a">
      <div style="font-size:10px;color:#71717a;margin-bottom:2px">${label}</div>
      <div style="font-size:22px;font-weight:900;color:#f4f4f5;line-height:1">${score}</div>
      <div style="height:3px;background:#27272a;border-radius:9999px;margin:5px 0 3px">
        <div style="height:3px;background:${bg};border-radius:9999px;width:${score}%"></div>
      </div>
      <div style="font-size:9px;color:#52525b">${sub}</div>
    </div>
  `;
}

function actionBtnStyle(bg, color) {
  return `background:${bg};color:${color};border:1px solid #27272a;border-radius:8px;
    padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;
    font-family:inherit;transition:all .15s`;
}

function insertPanel(panel) {
  const h1 = document.querySelector("h1");
  if (h1?.parentElement) h1.parentElement.insertBefore(panel, h1.nextSibling);
  else document.body.prepend(panel);
}

// ── main ──────────────────────────────────────────────────────────────────────
const scored = new Map();

async function scoreDetailView() {
  const token = await getToken();
  if (!token) return;

  const content = document.querySelector(".tab-content");
  if (!content || content.innerText.trim().length < 100) return;

  const detail = scrapeDetail();
  const existing = document.getElementById(CL_PANEL_ID);
  if (existing?.dataset.postingId === detail.posting_id) return;

  injectLoadingPanel(detail.posting_id);

  try {
    const [result, resume] = await Promise.all([
      fetchSingleScore(detail),
      getResume(),
    ]);

    await addToHistory({
      posting_id: detail.posting_id,
      title: detail.title,
      company_name: detail.company_name,
      score_total: result.score_total,
      score_stack: result.score_stack,
      score_company: result.score_company,
      score_clarity: result.score_clarity,
    });

    await injectFullPanel(result, detail, resume);
    scored.set(detail.posting_id, result);
  } catch (e) {
    document.getElementById(CL_PANEL_ID)?.remove();
    console.warn("[CoopLens] Score failed:", e.message);
  }
}

function scoreVisible() {
  if (isDetailView()) scoreDetailView();
}

// ── observer ──────────────────────────────────────────────────────────────────
const observer = new MutationObserver(() => {
  clearTimeout(observer._debounce);
  observer._debounce = setTimeout(scoreVisible, 400);
});

function start() {
  scoreVisible();
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "complete") setTimeout(start, 800);
else window.addEventListener("load", () => setTimeout(start, 800));
