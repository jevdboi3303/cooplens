export function ScoreBadge({ score, size = "md" }) {
  if (score == null) return <span className="text-zinc-500 text-xs">—</span>;

  const color =
    score >= 75 ? "bg-green-600 text-white"
    : score >= 50 ? "bg-amber-500 text-white"
    : "bg-red-600 text-white";

  const padding = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full font-bold ${color} ${padding}`}>
      {score}
    </span>
  );
}
