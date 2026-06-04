export function SignalBar({ label, value, max = 100 }) {
  if (value == null) return null;
  const pct = Math.round((value / max) * 100);
  const color =
    value >= 75 ? "bg-green-500"
    : value >= 50 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-semibold text-zinc-200">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
