import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ScoreBadge } from "../components/ScoreBadge";
import { SignalBar } from "../components/SignalBar";

export function Overview({ outcomes }) {
  const stats = useMemo(() => {
    if (!outcomes.length) return null;
    const withScore = outcomes.filter((o) => o.score_total != null);
    const avg = (arr) =>
      arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

    return {
      total: outcomes.length,
      avgTotal: avg(withScore.map((o) => o.score_total)),
      avgStack: avg(withScore.map((o) => o.score_stack).filter(Boolean)),
      avgCompany: avg(withScore.map((o) => o.score_company).filter(Boolean)),
      avgClarity: avg(withScore.map((o) => o.score_clarity).filter(Boolean)),
      interviews: outcomes.filter((o) => o.got_interview).length,
      offers: outcomes.filter((o) => o.got_offer).length,
      interviewRate: outcomes.filter((o) => o.got_interview != null).length
        ? Math.round(
            (outcomes.filter((o) => o.got_interview).length /
              outcomes.filter((o) => o.got_interview != null).length) *
              100
          )
        : null,
    };
  }, [outcomes]);

  const recent = outcomes.slice(0, 5);

  if (!outcomes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <span className="text-3xl">📭</span>
        <p>No postings viewed yet.</p>
        <p>Open the UVic co-op portal with the extension installed to start scoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Postings Viewed" value={stats.total} />
        <StatCard label="Avg Score" value={<ScoreBadge score={stats.avgTotal} size="lg" />} />
        <StatCard label="Interviews" value={`${stats.interviews}${stats.interviewRate != null ? ` (${stats.interviewRate}%)` : ""}`} />
        <StatCard label="Offers" value={stats.offers} />
      </div>

      {/* Signal averages */}
      <div className="bg-zinc-900 rounded-xl p-5 space-y-4 border border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Average Signal Scores</h2>
        <SignalBar label="Stack match" value={stats.avgStack} />
        <SignalBar label="Company quality" value={stats.avgCompany} />
        <SignalBar label="Posting clarity" value={stats.avgClarity} />
      </div>

      {/* Recent postings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-300">Recent Postings</h2>
          <Link to="/postings" className="text-xs text-blue-400 hover:underline">View all →</Link>
        </div>
        <div className="space-y-2">
          {recent.map((o) => (
            <div key={o.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <ScoreBadge score={o.score_total} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{o.posting_title || "Untitled"}</p>
                <p className="text-xs text-zinc-500 truncate">{o.company_name || "—"}</p>
              </div>
              {o.got_interview != null && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${o.got_interview ? "bg-green-900 text-green-300" : "bg-zinc-800 text-zinc-400"}`}>
                  {o.got_interview ? "Interview" : "No interview"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
    </div>
  );
}
