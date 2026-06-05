// Shared storage helpers for popup + content script

export function get(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r));
}
export function set(obj) {
  return new Promise(r => chrome.storage.local.set(obj, r));
}
export function remove(keys) {
  return new Promise(r => chrome.storage.local.remove(keys, r));
}

// ── Score history ─────────────────────────────────────────────────────────────
export async function addToHistory(entry) {
  const { cl_score_history = [] } = await get("cl_score_history");
  const filtered = cl_score_history.filter(e => e.posting_id !== entry.posting_id);
  const updated  = [{ ...entry, viewed_at: Date.now() }, ...filtered].slice(0, 50);
  await set({ cl_score_history: updated });
  return updated;
}

export async function getHistory() {
  const { cl_score_history = [] } = await get("cl_score_history");
  return cl_score_history;
}

// ── Shortlist ─────────────────────────────────────────────────────────────────
export async function toggleShortlist(entry) {
  const { cl_shortlist = [] } = await get("cl_shortlist");
  const exists = cl_shortlist.some(e => e.posting_id === entry.posting_id);
  const updated = exists
    ? cl_shortlist.filter(e => e.posting_id !== entry.posting_id)
    : [{ ...entry, starred_at: Date.now() }, ...cl_shortlist];
  await set({ cl_shortlist: updated });
  return !exists; // returns new starred state
}

export async function getShortlist() {
  const { cl_shortlist = [] } = await get("cl_shortlist");
  return cl_shortlist;
}

export async function isShortlisted(posting_id) {
  const list = await getShortlist();
  return list.some(e => e.posting_id === posting_id);
}

// ── Applied ───────────────────────────────────────────────────────────────────
export async function markApplied(entry) {
  const { cl_applied = [] } = await get("cl_applied");
  if (cl_applied.some(e => e.posting_id === entry.posting_id)) return;
  await set({ cl_applied: [{ ...entry, applied_at: Date.now() }, ...cl_applied] });
}

export async function isApplied(posting_id) {
  const { cl_applied = [] } = await get("cl_applied");
  return cl_applied.some(e => e.posting_id === posting_id);
}

// ── Watchlist ─────────────────────────────────────────────────────────────────
export async function addToWatchlist(entry) {
  const { cl_watchlist = [] } = await get("cl_watchlist");
  if (cl_watchlist.some(e => e.posting_id === entry.posting_id)) return cl_watchlist;
  const updated = [{ ...entry, added_at: Date.now() }, ...cl_watchlist];
  await set({ cl_watchlist: updated });
  return updated;
}

export async function removeFromWatchlist(posting_id) {
  const { cl_watchlist = [] } = await get("cl_watchlist");
  const updated = cl_watchlist.filter(e => e.posting_id !== posting_id);
  await set({ cl_watchlist: updated });
  return updated;
}

export async function getWatchlist() {
  const { cl_watchlist = [] } = await get("cl_watchlist");
  return cl_watchlist;
}

export function daysUntil(deadline_str) {
  if (!deadline_str) return null;
  const d = new Date(deadline_str);
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

// ── Compare list (session, max 3) ─────────────────────────────────────────────
export async function toggleCompare(entry) {
  const { cl_compare = [] } = await get("cl_compare");
  const exists = cl_compare.some(e => e.posting_id === entry.posting_id);
  let updated;
  if (exists) {
    updated = cl_compare.filter(e => e.posting_id !== entry.posting_id);
  } else {
    if (cl_compare.length >= 3) return { list: cl_compare, added: false, full: true };
    updated = [...cl_compare, entry];
  }
  await set({ cl_compare: updated });
  return { list: updated, added: !exists, full: false };
}

export async function getCompare() {
  const { cl_compare = [] } = await get("cl_compare");
  return cl_compare;
}
