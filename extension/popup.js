import {
  supabaseSignIn, supabaseSignUp, supabaseSignInWithGoogle,
  getToken, setToken, clearToken,
  getMe, register, uploadResume,
} from "./src/api.js";

// ── state ────────────────────────────────────────────────────────────────────
let state = {
  view: "loading", // loading | auth | onboarding | ready
  authTab: "signin", // signin | signup
  user: null,
  resume: null,
  error: null,
  loading: false,
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ── storage helpers ───────────────────────────────────────────────────────────
function getStored(keys) {
  return new Promise((res) => chrome.storage.local.get(keys, res));
}
function setStored(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}

// ── init ──────────────────────────────────────────────────────────────────────
async function init() {
  const { cl_token, cl_resume } = await getStored(["cl_token", "cl_resume"]);
  if (!cl_token) { setState({ view: "auth" }); return; }
  try {
    const user = await getMe();
    setState({ view: cl_resume ? "ready" : "onboarding", user, resume: cl_resume || null });
  } catch {
    setState({ view: "auth" });
  }
}

// ── auth handlers ─────────────────────────────────────────────────────────────
async function handleGoogleSignIn() {
  setState({ loading: true, error: null });
  try {
    const { access_token } = await supabaseSignInWithGoogle();
    await setToken(access_token);
    try { await register(); } catch { /* 409 = already registered */ }
    const me = await getMe();
    const { cl_resume } = await getStored(["cl_resume"]);
    setState({ view: cl_resume ? "ready" : "onboarding", user: me, resume: cl_resume || null, loading: false });
  } catch (e) {
    setState({ loading: false, error: e.message });
  }
}

async function handleSignIn(email, password) {
  setState({ loading: true, error: null });
  try {
    const { access_token, user } = await supabaseSignIn(email, password);
    await setToken(access_token);
    try { await register(); } catch { /* 409 = already registered, fine */ }
    const me = await getMe();
    const { cl_resume } = await getStored(["cl_resume"]);
    setState({ view: cl_resume ? "ready" : "onboarding", user: me, resume: cl_resume || null, loading: false });
  } catch (e) {
    setState({ loading: false, error: e.message });
  }
}

async function handleSignUp(email, password) {
  setState({ loading: true, error: null });
  try {
    await supabaseSignUp(email, password);
    setState({ loading: false, error: null, view: "auth", authTab: "signin",
      _info: "Check your email to confirm your account, then sign in." });
  } catch (e) {
    setState({ loading: false, error: e.message });
  }
}

async function signOut() {
  await clearToken();
  setState({ view: "auth", user: null, resume: null, error: null });
}

// ── resume upload ─────────────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file || file.type !== "application/pdf") {
    setState({ error: "Please choose a PDF file." });
    return;
  }
  setState({ loading: true, error: null });
  try {
    const result = await uploadResume(file);
    const meta = { name: file.name, skills: result.skills_detected, uploadedAt: Date.now() };
    await setStored({ cl_resume: meta });
    setState({ view: "ready", resume: meta, loading: false });
  } catch (e) {
    setState({ loading: false, error: e.message });
  }
}

// ── render ────────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("root");
  root.innerHTML = "";
  const popup = el("div", { className: "popup" });
  popup.appendChild(renderHeader());

  if (state.view === "loading") {
    popup.appendChild(el("div", { className: "status-banner" }, [
      el("div", { className: "spinner" }),
      el("span", {}, ["Loading…"]),
    ]));
  } else if (state.view === "auth") {
    popup.appendChild(renderAuth());
  } else if (state.view === "onboarding") {
    popup.appendChild(renderUserRow());
    popup.appendChild(renderUpload());
  } else if (state.view === "ready") {
    popup.appendChild(renderUserRow());
    popup.appendChild(renderResumeRow());
    popup.appendChild(renderStatus());
  }

  if (state.error) popup.appendChild(el("p", { className: "error-text" }, [state.error]));
  if (state._info) popup.appendChild(el("p", { className: "info-text" }, [state._info]));
  root.appendChild(popup);
}

function renderHeader() {
  return el("div", { className: "header" }, [
    el("div", { className: "logo" }, ["Coop", el("span", {}, ["Lens"])]),
    el("span", { className: "tagline" }, ["Score smarter. Apply better."]),
  ]);
}

function renderAuth() {
  const isSignIn = state.authTab === "signin";

  const frag = document.createDocumentFragment();

  // Tab switcher
  const tabs = el("div", { className: "tab-row" });
  ["signin", "signup"].forEach((tab) => {
    const btn = el("button", {
      className: `tab-btn${state.authTab === tab ? " active" : ""}`,
    }, [tab === "signin" ? "Sign in" : "Sign up"]);
    btn.addEventListener("click", () => setState({ authTab: tab, error: null }));
    tabs.appendChild(btn);
  });
  frag.appendChild(tabs);

  // Form
  const form = el("form", { className: "auth-form" });
  const emailInput = el("input", { type: "email", placeholder: "you@uvic.ca", className: "text-input", required: "true" });
  const passInput = el("input", { type: "password", placeholder: "Password", className: "text-input", required: "true" });
  form.appendChild(emailInput);
  form.appendChild(passInput);

  const submitBtn = el("button", {
    type: "submit",
    className: "btn-primary" + (state.loading ? " disabled" : ""),
  }, [
    ...(state.loading ? [el("div", { className: "spinner" })] : []),
    isSignIn ? "Sign in" : "Create account",
  ]);
  if (state.loading) submitBtn.setAttribute("disabled", "true");
  form.appendChild(submitBtn);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const pass = passInput.value;
    if (isSignIn) handleSignIn(email, pass);
    else handleSignUp(email, pass);
  });

  frag.appendChild(form);

  // Divider
  const divider = el("div", { className: "divider" }, [
    el("span", {}, ["or"]),
  ]);
  frag.appendChild(divider);

  // Google button
  const googleBtn = el("button", { className: "btn-google" + (state.loading ? " disabled" : "") }, [
    el("span", { className: "google-icon" }, ["G"]),
    "Continue with Google",
  ]);
  if (state.loading) googleBtn.setAttribute("disabled", "true");
  googleBtn.addEventListener("click", handleGoogleSignIn);
  frag.appendChild(googleBtn);

  return frag;
}

function renderUserRow() {
  const initial = state.user?.email?.[0]?.toUpperCase() || "?";
  const row = el("div", { className: "user-row" }, [
    el("div", { className: "avatar" }, [initial]),
    el("span", { className: "user-email" }, [state.user?.email || ""]),
  ]);
  const out = el("button", { className: "sign-out" }, ["Sign out"]);
  out.addEventListener("click", signOut);
  row.appendChild(out);
  return row;
}

function renderUpload() {
  const frag = document.createDocumentFragment();
  frag.appendChild(el("p", { className: "section-label" }, ["Upload your resume"]));

  const area = el("div", { className: "upload-area" });
  const input = el("input", { type: "file", accept: ".pdf" });
  area.innerHTML = `<div style="font-size:24px">📄</div>`;
  area.appendChild(el("p", {}, ["Drop your PDF here or click to browse"]));
  area.appendChild(input);

  area.addEventListener("click", () => input.click());
  area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("drag-over"); });
  area.addEventListener("dragleave", () => area.classList.remove("drag-over"));
  area.addEventListener("drop", (e) => { e.preventDefault(); area.classList.remove("drag-over"); handleFile(e.dataTransfer.files[0]); });
  input.addEventListener("change", () => handleFile(input.files[0]));
  frag.appendChild(area);

  if (state.loading) {
    frag.appendChild(el("div", { className: "status-banner", style: "margin-top:10px" }, [
      el("div", { className: "spinner" }),
      el("span", {}, ["Uploading & parsing…"]),
    ]));
  }
  return frag;
}

function renderResumeRow() {
  const frag = document.createDocumentFragment();
  frag.appendChild(el("p", { className: "section-label" }, ["Resume"]));
  const row = el("div", { className: "resume-row" }, [
    el("span", { className: "resume-icon" }, ["📄"]),
    el("div", { className: "resume-info" }, [
      el("div", { className: "resume-name" }, [state.resume?.name || "resume.pdf"]),
      el("div", { className: "resume-sub" }, [`${state.resume?.skills?.length || 0} skills detected`]),
    ]),
  ]);
  const replace = el("button", { className: "btn-secondary" }, ["Replace"]);
  replace.addEventListener("click", () => setState({ view: "onboarding" }));
  row.appendChild(replace);
  frag.appendChild(row);
  return frag;
}

function renderStatus() {
  const banner = el("div", { className: "status-banner" }, [
    el("div", { className: "status-dot gray" }),
    el("span", { className: "status-text" }, ["Checking portal…"]),
  ]);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const onPortal = (tabs[0]?.url || "").includes("learninginmotion.uvic.ca");
    const dot = banner.querySelector(".status-dot");
    const text = banner.querySelector(".status-text");
    dot.className = `status-dot ${onPortal ? "green" : "yellow"}`;
    text.textContent = onPortal
      ? "Active — scoring postings on this page"
      : "Open the UVic co-op portal to see scores";
  });
  return banner;
}

// ── DOM helper ────────────────────────────────────────────────────────────────
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child instanceof Node) node.appendChild(child);
  }
  return node;
}

// Module scripts execute after DOM is ready, so call directly
init();
