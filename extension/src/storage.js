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
