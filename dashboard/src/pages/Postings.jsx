import { useState, useMemo } from "react";
import { ScoreBadge } from "../components/ScoreBadge";
import { SignalBar } from "../components/SignalBar";

const SORT_OPTIONS = [
  { value: "score_total", label: "Total Score" },
  { value: "recorded_at", label: "Date Viewed" },
  { value: "score_stack", label: "Stack Match" },
  { value: "score_company", label: "Company Quality" },
];

export function Postings({ outcomes }) {
  const [sort, setSort] = useState("score_total");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...outcomes]
      .filter(
        (o) =>
          !q ||
          o.posting_title?.toLowerCase().includes(q) ||
          o.company_name?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sort === "recorded_at")
          return new Date(b.recorded_at) - new Date(a.recorded_at);
        return (b[sort] ?? 0) - (a[sort] ?? 0);
      });
  }, [outcomes, sort, search]);

  function exportCSV() {
    const headers = ["ID","Title","Company","Score","CV Match","Company Score","Clarity","Recommendation","Date Viewed"];
    const rows = filtered.map(o => [
      o.posting_id, o.posting_title, o.company_name,
      o.score_total, o.score_cv ?? o.score_stack, o.score_company, o.score_clarity,
      o.recommendation || "",
      o.recorded_at ? new Date(o.recorded_at).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `cooplens-postings-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Postings</h1>
        <button onClick={exportCSV} className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors">
          ↓ Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search title or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">No postings found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
              >
                <ScoreBadge score={o.score_total} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.posting_title || "Untitled"}</p>
                  <p className="text-xs text-zinc-500">{o.company_name || "—"} · {formatDate(o.recorded_at)}</p>
                </div>
                {o.got_interview != null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${o.got_interview ? "bg-green-900 text-green-300" : "bg-zinc-800 text-zinc-400"}`}>
                    {o.got_interview ? "Interview" : "No interview"}
                  </span>
                )}
                <span className="text-zinc-600 text-xs">{expanded === o.id ? "▲" : "▼"}</span>
              </button>

              {expanded === o.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                  <SignalBar label="CV Match" value={o.score_cv ?? o.score_stack} />
                  <SignalBar label="Company quality" value={o.score_company} />
                  <SignalBar label="Posting clarity" value={o.score_clarity} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
