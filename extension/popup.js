import {
  supabaseSignIn, supabaseSignUp,
  getToken, setToken, clearToken,
  getMe, register, uploadResume,
  updateFaculty, getKeywordSuggestions, getInterviewRate,
} from "./src/api.js";
import {
  get, set, getHistory, getShortlist, getCompare
} from "./src/storage.js";

// ── state ─────────────────────────────────────────────────────────────────────
const FACULTIES = [
  "Computer Science", "Software Engineering", "Electrical Engineering",
  "Mechanical Engineering", "Data Science", "Business",
  "Biology", "Chemistry", "Physics", "Environmental Science", "Other",
];

let state = {
  view: "loading",   // loading | auth | onboarding | dashboard
  authTab: "signin",
  user: null,
  resume: null,
  history: [],
  shortlist: [],
  watchlist: [],
  compare: [],
  onPortal: false,
  dashTab: "recent", // recent | shortlist | watchlist | compare | insights
  insights: null,
  error: null,
  info: null,
  loading: false,
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ── init ──────────────────────────────────────────────────────────────────────
async function init() {
  const { cl_token, cl_resume } = await get(["cl_token", "cl_resume"]);
  if (!cl_token) { setState({ view: "auth" }); return; }

  const [history, shortlist, compare, watchlistData] = await Promise.all([
    getHistory(), getShortlist(), getCompare(),
    get("cl_watchlist").then(r => r.cl_watchlist || []),
  ]);

  try {
    const user = await getMe();
    setState({
      view: cl_resume ? "dashboard" : "onboarding",
      user, resume: cl_resume || null,
      history, shortlist, compare, watchlist: watchlistData,
    });
    updatePortalStatus();
  } catch {
    setState({ view: "auth" });
  }
}

function updatePortalStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || "";
    const onPortal = url.includes("learninginmotion.uvic.ca");
    setState({ onPortal });
  });
}

// ── auth ──────────────────────────────────────────────────────────────────────
async function handleSignIn(email, password) {
  setState({ loading: true, error: null });
  try {
    const { access_token, refresh_token } = await supabaseSignIn(email, password);
    await setToken(access_token, refresh_token);
    try { await register(); } catch { /* 409 */ }
    const user = await getMe();
    const { cl_resume } = await get("cl_resume");
    const [history, shortlist, compare] = await Promise.all([getHistory(), getShortlist(), getCompare()]);
    setState({ view: cl_resume ? "dashboard" : "onboarding", user, resume: cl_resume || null, history, shortlist, compare, loading: false });
    updatePortalStatus();
  } catch (e) { setState({ loading: false, error: e.message }); }
}

async function handleSignUp(email, password) {
  setState({ loading: true, error: null });
  try {
    await supabaseSignUp(email, password);
    setState({ loading: false, info: "Check your email to confirm, then sign in.", authTab: "signin" });
  } catch (e) { setState({ loading: false, error: e.message }); }
}

async function signOut() {
  await clearToken();
  setState({ view: "auth", user: null, resume: null, error: null, history: [], shortlist: [], compare: [] });
}

// ── resume ────────────────────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file || file.type !== "application/pdf") { setState({ error: "Please choose a PDF file." }); return; }
  setState({ loading: true, error: null });
  try {
    const result = await uploadResume(file);
    const meta = { name: file.name, skills: result.skills_detected, uploadedAt: Date.now() };
    await set({ cl_resume: meta });
    const [history, shortlist, compare] = await Promise.all([getHistory(), getShortlist(), getCompare()]);
    setState({ view: "dashboard", resume: meta, history, shortlist, compare, loading: false });
    updatePortalStatus();
  } catch (e) { setState({ loading: false, error: e.message }); }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 75) return { bg: "#16a34a", text: "#fff" };
  if (score >= 50) return { bg: "#d97706", text: "#fff" };
  return { bg: "#dc2626", text: "#fff" };
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

// ── render ────────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("root");
  root.innerHTML = "";
  const popup = el("div", { className: "popup" });

  if (state.view === "loading") {
    popup.appendChild(renderHeader());
    popup.appendChild(el("div", { className: "status-pill" }, [el("div", { className: "spinner" }), el("span", {}, ["Loading…"])]));
  } else if (state.view === "auth") {
    popup.appendChild(renderHeader());
    popup.appendChild(renderAuth());
  } else if (state.view === "onboarding") {
    popup.appendChild(renderHeader(true));
    popup.appendChild(renderOnboarding());
  } else if (state.view === "dashboard") {
    popup.appendChild(renderHeader(true));
    popup.appendChild(renderDashboard());
  }

  if (state.error) popup.appendChild(el("p", { className: "error-text" }, [state.error]));
  if (state.info)  popup.appendChild(el("p", { className: "info-text" }, [state.info]));
  root.appendChild(popup);
}

function renderHeader(showUser = false) {
  const header = el("div", { className: "header" });
  header.appendChild(el("div", { className: "logo" }, ["Coop", el("span", {}, ["Lens"])]));
  const actions = el("div", { className: "header-actions" });
  if (showUser && state.user) {
    const resumeBtn = el("button", { className: "btn-icon" }, ["📄 Resume"]);
    resumeBtn.addEventListener("click", () => setState({ view: "onboarding" }));
    actions.appendChild(resumeBtn);
    const outBtn = el("button", { className: "btn-icon" }, ["Sign out"]);
    outBtn.addEventListener("click", signOut);
    actions.appendChild(outBtn);
  }
  header.appendChild(actions);
  return header;
}

function renderAuth() {
  const frag = document.createDocumentFragment();
  const isSignIn = state.authTab === "signin";

  const tabs = el("div", { className: "tab-row" });
  ["signin", "signup"].forEach(tab => {
    const btn = el("button", { className: `tab-btn${state.authTab === tab ? " active" : ""}` }, [tab === "signin" ? "Sign in" : "Sign up"]);
    btn.addEventListener("click", () => setState({ authTab: tab, error: null, info: null }));
    tabs.appendChild(btn);
  });
  frag.appendChild(tabs);

  const form = el("form", { className: "auth-form" });
  const emailIn = el("input", { type: "email", placeholder: "you@uvic.ca", className: "text-input", required: "true" });
  const passIn  = el("input", { type: "password", placeholder: "Password", className: "text-input", required: "true" });
  const submit  = el("button", { type: "submit", className: "btn-primary" }, [
    ...(state.loading ? [el("div", { className: "spinner" })] : []),
    isSignIn ? "Sign in" : "Create account",
  ]);
  if (state.loading) submit.setAttribute("disabled", "true");
  form.appendChild(emailIn);
  form.appendChild(passIn);
  form.appendChild(submit);
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (isSignIn) handleSignIn(emailIn.value.trim(), passIn.value);
    else handleSignUp(emailIn.value.trim(), passIn.value);
  });
  frag.appendChild(form);
  return frag;
}

function renderOnboarding() {
  const frag = document.createDocumentFragment();

  if (state.resume) {
    const card = el("div", { className: "resume-card" });
    card.appendChild(el("span", {}, ["📄"]));
    const info = el("div", { style: "flex:1;min-width:0" });
    info.appendChild(el("div", { className: "name" }, [state.resume.name || "resume.pdf"]));
    info.appendChild(el("div", { className: "sub" }, [`${state.resume.skills?.length || 0} skills detected`]));
    card.appendChild(info);
    frag.appendChild(card);
  }

  frag.appendChild(el("p", { className: "section-title" }, [state.resume ? "Replace resume" : "Upload your resume"]));

  const area = el("div", { className: "upload-area" });
  const input = el("input", { type: "file", accept: ".pdf" });
  area.innerHTML = `<div style="font-size:22px">📄</div>`;
  area.appendChild(el("p", {}, ["Drop PDF here or click to browse"]));
  area.appendChild(input);
  area.addEventListener("click", () => input.click());
  area.addEventListener("dragover", e => { e.preventDefault(); area.classList.add("drag-over"); });
  area.addEventListener("dragleave", () => area.classList.remove("drag-over"));
  area.addEventListener("drop", e => { e.preventDefault(); area.classList.remove("drag-over"); handleFile(e.dataTransfer.files[0]); });
  input.addEventListener("change", () => handleFile(input.files[0]));
  frag.appendChild(area);

  if (state.loading) {
    frag.appendChild(el("div", { className: "status-pill" }, [el("div", { className: "spinner" }), el("span", {}, ["Parsing resume…"])]));
  }

  if (state.resume) {
    const skip = el("button", { className: "btn-secondary", style: "width:100%;justify-content:center;margin-top:4px" }, ["← Back to dashboard"]);
    skip.addEventListener("click", () => setState({ view: "dashboard" }));
    frag.appendChild(skip);
  }

  return frag;
}

function renderDashboard() {
  const frag = document.createDocumentFragment();

  // Portal status
  const pill = el("div", { className: "status-pill" });
  const dot  = el("div", { className: `status-dot ${state.onPortal ? "green" : "yellow"}` });
  const msg  = state.onPortal
    ? "Active — scoring postings on this page"
    : "Open the UVic co-op portal to score jobs";
  pill.appendChild(dot);
  pill.appendChild(el("span", {}, [msg]));
  if (!state.onPortal) {
    const link = el("a", { href: "https://learninginmotion.uvic.ca/myAccount/co-op/postings.htm", target: "_blank", style: "margin-left:auto;font-size:10px;color:#3b82f6;text-decoration:none" }, ["Open →"]);
    pill.appendChild(link);
  }
  frag.appendChild(pill);

  // Stats row
  const avgScore = state.history.length
    ? Math.round(state.history.reduce((s, h) => s + (h.score_total || 0), 0) / state.history.length)
    : "—";
  const stats = el("div", { className: "stats-row" });
  [
    { value: state.history.length, label: "Scored" },
    { value: avgScore, label: "Avg Score" },
    { value: state.shortlist.length, label: "Starred" },
  ].forEach(({ value, label }) => {
    const card = el("div", { className: "stat-card" });
    card.appendChild(el("div", { className: "stat-value" }, [String(value)]));
    card.appendChild(el("div", { className: "stat-label" }, [label]));
    stats.appendChild(card);
  });
  frag.appendChild(stats);

  // Tab switcher — two rows of tabs
  const tabs1 = el("div", { className: "tab-row" });
  [["recent", "Recent"], ["shortlist", "★ Starred"], ["watchlist", `🔔 Watch (${state.watchlist.length})`]].forEach(([key, label]) => {
    const btn = el("button", { className: `tab-btn${state.dashTab === key ? " active" : ""}` }, [label]);
    btn.addEventListener("click", () => setState({ dashTab: key }));
    tabs1.appendChild(btn);
  });
  const tabs2 = el("div", { className: "tab-row", style: "margin-top:4px" });
  [["compare", `↔ Compare (${state.compare.length})`], ["insights", "💡 Insights"]].forEach(([key, label]) => {
    const btn = el("button", { className: `tab-btn${state.dashTab === key ? " active" : ""}` }, [label]);
    btn.addEventListener("click", () => {
      if (key === "insights" && !state.insights) loadInsights();
      setState({ dashTab: key });
    });
    tabs2.appendChild(btn);
  });
  frag.appendChild(tabs1);
  frag.appendChild(tabs2);

  // Tab content
  if (state.dashTab === "recent")    frag.appendChild(renderScoreList(state.history.slice(0, 8), "No postings scored yet.\nOpen a job posting on the portal."));
  if (state.dashTab === "shortlist") frag.appendChild(renderScoreList(state.shortlist, "No starred postings.\nStar a posting from the detail panel."));
  if (state.dashTab === "watchlist") frag.appendChild(renderWatchlist());
  if (state.dashTab === "compare")   frag.appendChild(renderCompare());
  if (state.dashTab === "insights")  frag.appendChild(renderInsights());

  return frag;
}

function renderScoreList(items, emptyMsg) {
  if (!items.length) {
    const wrap = el("div", { className: "empty-state" });
    wrap.appendChild(el("div", { className: "icon" }, ["📭"]));
    emptyMsg.split("\n").forEach(line => wrap.appendChild(el("p", {}, [line])));
    return wrap;
  }
  const list = el("div", { className: "score-list" });
  items.forEach(item => {
    const { bg, text } = scoreColor(item.score_total);
    const row = el("div", { className: "score-row" });
    const badge = el("span", { className: "score-badge" }, [String(item.score_total ?? "?")]);
    badge.style.background = bg;
    badge.style.color = text;
    const info = el("div", { className: "score-info" });
    info.appendChild(el("div", { className: "score-title" }, [item.title || item.posting_title || "Untitled"]));
    info.appendChild(el("div", { className: "score-company" }, [item.company_name || item.company || "—"]));
    row.appendChild(badge);
    row.appendChild(info);
    const ts = item.viewed_at || item.starred_at;
    if (ts) row.appendChild(el("span", { className: "score-time" }, [timeAgo(ts)]));
    list.appendChild(row);
  });
  return list;
}

function renderCompare() {
  if (!state.compare.length) {
    const wrap = el("div", { className: "empty-state" });
    wrap.appendChild(el("div", { className: "icon" }, ["↔"]));
    wrap.appendChild(el("p", {}, ["No postings in compare list."]));
    wrap.appendChild(el("p", {}, ["Click ↔ Compare on a job detail page."]));
    return wrap;
  }

  const list = el("div", { className: "score-list" });
  state.compare.forEach(item => {
    const { bg, text } = scoreColor(item.score_total);
    const row = el("div", { className: "score-row" });
    const badge = el("span", { className: "score-badge" }, [String(item.score_total ?? "?")]);
    badge.style.background = bg;
    badge.style.color = text;
    const info = el("div", { className: "score-info" });
    info.appendChild(el("div", { className: "score-title" }, [item.title || "Untitled"]));
    info.appendChild(el("div", { className: "score-company" }, [item.company_name || "—"]));
    row.appendChild(badge);
    row.appendChild(info);
    list.appendChild(row);
  });

  // Clear compare
  const clear = el("button", { className: "btn-secondary", style: "width:100%;justify-content:center;margin-top:6px" }, ["Clear compare list"]);
  clear.addEventListener("click", async () => {
    await set({ cl_compare: [] });
    const compare = await getCompare();
    setState({ compare });
  });

  const wrap = document.createDocumentFragment();
  wrap.appendChild(list);
  wrap.appendChild(clear);
  return wrap;
}

// ── Insights loader ───────────────────────────────────────────────────────────
async function loadInsights() {
  setState({ insights: { loading: true } });
  try {
    const [suggestions, rate] = await Promise.all([
      getKeywordSuggestions(),
      getInterviewRate(),
    ]);
    setState({ insights: { suggestions, rate } });
  } catch (e) {
    setState({ insights: { error: e.message } });
  }
}

// ── Watchlist renderer ────────────────────────────────────────────────────────
function renderWatchlist() {
  if (!state.watchlist.length) {
    const wrap = el("div", { className: "empty-state" });
    wrap.appendChild(el("div", { className: "icon" }, ["🔔"]));
    wrap.appendChild(el("p", {}, ["No watched postings."]));
    wrap.appendChild(el("p", {}, ["Click 🔔 Watch on a posting to track its deadline."]));
    return wrap;
  }
  const list = el("div", { className: "score-list" });
  state.watchlist.forEach(item => {
    const days = item.deadline ? Math.ceil((new Date(item.deadline) - Date.now()) / 86400000) : null;
    const { bg, text } = scoreColor(item.score_total);
    const row = el("div", { className: "score-row" });
    const badge = el("span", { className: "score-badge" }, [String(item.score_total ?? "?")]);
    badge.style.background = bg; badge.style.color = text;
    const info = el("div", { className: "score-info" });
    info.appendChild(el("div", { className: "score-title" }, [item.title || "Untitled"]));
    info.appendChild(el("div", { className: "score-company" }, [item.company_name || "—"]));
    row.appendChild(badge);
    row.appendChild(info);
    if (days !== null) {
      const deadlineEl = el("span", { className: "score-time" }, [
        days <= 0 ? "Expired" : days === 1 ? "1 day left" : `${days}d left`
      ]);
      if (days <= 3) deadlineEl.style.color = "#ef4444";
      else if (days <= 7) deadlineEl.style.color = "#f97316";
      row.appendChild(deadlineEl);
    }
    list.appendChild(row);
  });
  return list;
}

// ── Insights renderer ─────────────────────────────────────────────────────────
function renderInsights() {
  const frag = document.createDocumentFragment();

  // Faculty selector
  const facultyWrap = el("div", { style: "margin-bottom:10px" });
  facultyWrap.appendChild(el("p", { className: "section-title" }, ["Your Program"]));
  const sel = el("select", { className: "text-input", style: "width:100%" });
  sel.appendChild(el("option", { value: "" }, ["Select your faculty…"]));
  FACULTIES.forEach(f => {
    const opt = el("option", { value: f }, [f]);
    if (state.user?.faculty === f) opt.setAttribute("selected", "true");
    sel.appendChild(opt);
  });
  sel.addEventListener("change", async (e) => {
    if (!e.target.value) return;
    try {
      await updateFaculty(e.target.value);
      setState({ user: { ...state.user, faculty: e.target.value }, info: `Program set to ${e.target.value}` });
      loadInsights();
    } catch {}
  });
  facultyWrap.appendChild(sel);
  frag.appendChild(facultyWrap);

  if (!state.insights) {
    const btn = el("button", { className: "btn-primary", style: "margin-bottom:10px" }, ["Generate insights"]);
    btn.addEventListener("click", loadInsights);
    frag.appendChild(btn);
    return frag;
  }

  if (state.insights.loading) {
    frag.appendChild(el("div", { className: "status-pill" }, [el("div", { className: "spinner" }), el("span", {}, ["Analyzing with Llama 3.3…"])]));
    return frag;
  }

  if (state.insights.error) {
    frag.appendChild(el("p", { className: "error-text" }, [state.insights.error]));
    return frag;
  }

  // Keyword suggestions
  const { suggestions } = state.insights;
  if (suggestions?.suggestions?.length) {
    frag.appendChild(el("p", { className: "section-title" }, ["Skills to Add to Your Resume"]));
    const list = el("div", { className: "score-list" });
    suggestions.suggestions.forEach(s => {
      const row = el("div", { className: "score-row" });
      const pri = el("span", { className: "score-badge" }, [s.priority === "high" ? "🔥" : s.priority === "medium" ? "→" : "~"]);
      pri.style.background = s.priority === "high" ? "#7c2d12" : s.priority === "medium" ? "#1e3a5f" : "#18181b";
      pri.style.color = "#fff";
      const info = el("div", { className: "score-info" });
      info.appendChild(el("div", { className: "score-title" }, [s.skill]));
      info.appendChild(el("div", { className: "score-company" }, [s.reason]));
      row.appendChild(pri);
      row.appendChild(info);
      list.appendChild(row);
    });
    frag.appendChild(list);
  }

  // Interview rate
  const { rate } = state.insights;
  if (rate?.enough_data) {
    frag.appendChild(el("p", { className: "section-title", style: "margin-top:10px" }, ["Interview Likelihood"]));
    const card = el("div", { className: "stat-card", style: "margin-bottom:8px;text-align:left;padding:10px 12px" });
    card.appendChild(el("div", { className: "stat-value" }, [`${rate.overall_rate}%`]));
    card.appendChild(el("div", { className: "stat-label" }, ["overall interview rate from your applications"]));
    if (rate.interview_threshold) {
      card.appendChild(el("div", { className: "stat-label", style: "margin-top:6px;color:#22c55e" }, [
        `✓ Postings scoring ${rate.interview_threshold}+ have higher interview rates`
      ]));
    }
    frag.appendChild(card);
  } else if (rate && !rate.enough_data) {
    frag.appendChild(el("p", { className: "info-text" }, [
      `${rate.message} — keep marking outcomes after interviews to unlock predictions.`
    ]));
  }

  return frag;
}

// ── DOM helper ────────────────────────────────────────────────────────────────
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child instanceof Node) node.appendChild(child);
  }
  return node;
}

// ── boot ──────────────────────────────────────────────────────────────────────
init();
