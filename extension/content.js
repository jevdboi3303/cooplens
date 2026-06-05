/**
 * CoopLens content script — runs on learninginmotion.uvic.ca
 *
 * Portal structure (confirmed via DOM inspection 2026-06-04):
 *   - Postings render in #postingsTable as <tbody><tr> rows
 *   - Title: td.orgDivTitleMaxWidth.align--middle [data-totitle]
 *   - Company: second td.orgDivTitleMaxWidth [data-totitle]
 *   - Posting ID: extracted from apply button class np-apply-btn-{id}
 *   - No description in table — we compose from title + company + position type + location
 */

const CL_ATTR = "data-cl-scored"; // marks cards we've already processed
const scored = new Map(); // posting_id → ScoreResult

// ── auth check ──────────────────────────────────────────────────────────────
async function getToken() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, (r) => resolve(r?.token || null));
  });
}

// ── scraping ─────────────────────────────────────────────────────────────────
function scrapeCard(card, index) {
  const cells = card.querySelectorAll("td");

  // Posting ID from apply button class: "np-apply-btn-257984"
  const applyBtn = card.querySelector('a[class*="np-apply-btn-"]');
  const idMatch = applyBtn?.className.match(/np-apply-btn-(\d+)/);
  const posting_id = idMatch ? idMatch[1] : `cl-${index}`;

  // Title from data-totitle on the title cell (index 3)
  const title = cells[3]?.getAttribute("data-totitle")
    || cells[3]?.innerText?.trim()
    || "Unknown Role";

  // Company from data-totitle on org cell (index 4)
  const company_name = cells[4]?.getAttribute("data-totitle")
    || cells[4]?.innerText?.trim()
    || "";

  // Compose a description from available fields — position type (6) + location (7)
  const positionType = cells[6]?.innerText?.trim() || "";
  const location = cells[7]?.innerText?.trim() || "";
  const description = [title, company_name, positionType, location].filter(Boolean).join(". ");

  return { posting_id, title, company_name, description };
}

function getUnscored() {
  const cards = [...document.querySelectorAll("#postingsTable tbody tr")];
  return cards
    .map((card, i) => ({ card, data: scrapeCard(card, i) }))
    .filter(({ card, data }) => !card.hasAttribute(CL_ATTR) && data.posting_id.length > 0);
}

// ── scoring API call (via background to avoid mixed-content block) ────────────
async function fetchScores(postings) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SCORE_BATCH", postings }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Score request failed"));
        return;
      }
      resolve(response.data.scores);
    });
  });
}

// ── badge injection ──────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 75) return { bg: "#16a34a", text: "#fff", label: "Strong" };
  if (score >= 50) return { bg: "#d97706", text: "#fff", label: "Okay" };
  return { bg: "#dc2626", text: "#fff", label: "Weak" };
}

function injectBadge(card, scoreData) {
  // Remove any existing badge (re-render on resume change)
  card.querySelector(".cl-badge")?.remove();
  card.querySelector(".cl-tooltip")?.remove();

  const { score_total, score_stack, score_company, score_clarity } = scoreData;
  const { bg, text, label } = scoreColor(score_total);

  // Badge pill
  const badge = document.createElement("div");
  badge.className = "cl-badge";
  badge.setAttribute("data-cl-badge", "true");
  badge.style.cssText = `
    display:inline-flex;align-items:center;gap:5px;
    padding:3px 10px;border-radius:999px;
    background:${bg};color:${text};
    font-size:12px;font-weight:700;font-family:sans-serif;
    cursor:default;position:relative;z-index:10;
    margin:4px 0;
  `;
  badge.innerHTML = `<span style="font-size:10px">●</span> ${score_total} <span style="font-weight:400;opacity:0.85">${label}</span>`;

  // Tooltip
  const tip = document.createElement("div");
  tip.className = "cl-tooltip";
  tip.style.cssText = `
    display:none;position:absolute;z-index:9999;
    background:#111;color:#f0f0f0;
    border:1px solid #333;border-radius:10px;
    padding:12px 14px;width:220px;
    font-size:12px;font-family:sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,0.5);
    pointer-events:none;
  `;
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;font-size:13px">CoopLens Score: ${score_total}</div>
    ${signalRow("Stack match", score_stack, "How well your resume skills overlap with this posting.")}
    ${signalRow("Company quality", score_company, "Company size and funding stage via Clearbit.")}
    ${signalRow("Posting clarity", score_clarity, "Salary, specificity, and structured requirements.")}
  `;

  badge.appendChild(tip);
  badge.addEventListener("mouseenter", () => {
    tip.style.display = "block";
    // position above the badge
    const rect = badge.getBoundingClientRect();
    tip.style.top = `-${tip.offsetHeight + 8}px`;
    tip.style.left = "0";
  });
  badge.addEventListener("mouseleave", () => { tip.style.display = "none"; });

  card.setAttribute(CL_ATTR, score_total);
  card.style.position = "relative"; // ensure tooltip anchors correctly
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

// ── main loop ─────────────────────────────────────────────────────────────────
async function scoreVisible() {
  const token = await getToken();
  if (!token) return; // not signed in — badges stay hidden

  const unscoredItems = getUnscored();
  if (!unscoredItems.length) return;

  const postings = unscoredItems.map((i) => i.data);

  let scores;
  try {
    scores = await fetchScores(postings);
  } catch (e) {
    console.warn("[CoopLens] Score fetch failed:", e.message);
    return;
  }

  const scoreMap = new Map(scores.map((s) => [s.posting_id, s]));
  for (const { card, data } of unscoredItems) {
    const s = scoreMap.get(data.posting_id);
    if (s) {
      injectBadge(card, s);
      scored.set(data.posting_id, s);
    }
  }
}

// ── observer ──────────────────────────────────────────────────────────────────
const observer = new MutationObserver(() => {
  clearTimeout(observer._debounce);
  observer._debounce = setTimeout(scoreVisible, 400);
});

function start() {
  scoreVisible();

  const target = document.querySelector("#postingsTable tbody") || document.body;
  observer.observe(target, { childList: true, subtree: true });
}

// Delay slightly so the portal SPA has time to hydrate
if (document.readyState === "complete") {
  setTimeout(start, 800);
} else {
  window.addEventListener("load", () => setTimeout(start, 800));
}
