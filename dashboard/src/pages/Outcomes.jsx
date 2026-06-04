import { useState } from "react";
import { ScoreBadge } from "../components/ScoreBadge";

export function Outcomes({ outcomes, markOffer }) {
  const [filter, setFilter] = useState("all");

  const filtered = outcomes.filter((o) => {
    if (filter === "interview") return o.got_interview === true;
    if (filter === "no_interview") return o.got_interview === false;
    if (filter === "pending") return o.got_interview == null;
    return true;
  });

  const tabs = [
    { key: "all", label: "All" },
    { key: "interview", label: "Got Interview" },
    { key: "no_interview", label: "No Interview" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Outcomes</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              filter === t.key
                ? "bg-zinc-700 text-white font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">No outcomes in this category.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OutcomeRow key={o.id} outcome={o} markOffer={markOffer} />
          ))}
        </div>
      )}
    </div>
  );
}

function OutcomeRow({ outcome: o, markOffer }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
      <ScoreBadge score={o.score_total} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{o.posting_title || "Untitled"}</p>
        <p className="text-xs text-zinc-500 truncate">{o.company_name || "—"} · {formatDate(o.recorded_at)}</p>
      </div>

      {/* Interview badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
        o.got_interview === true ? "bg-green-900 text-green-300"
        : o.got_interview === false ? "bg-zinc-800 text-zinc-400"
        : "bg-zinc-800 text-zinc-500"
      }`}>
        {o.got_interview === true ? "Interview" : o.got_interview === false ? "No interview" : "Pending"}
      </span>

      {/* Offer toggle — only shown if they got an interview */}
      {o.got_interview === true && (
        <button
          onClick={() => markOffer(o.id, !o.got_offer)}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
            o.got_offer
              ? "bg-blue-900 border-blue-700 text-blue-200"
              : "border-zinc-700 text-zinc-500 hover:border-blue-600 hover:text-blue-300"
          }`}
        >
          {o.got_offer ? "✓ Offer" : "Mark offer"}
        </button>
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
