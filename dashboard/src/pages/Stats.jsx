import { useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Legend,
} from "recharts";

export function Stats({ outcomes }) {
  const data = useMemo(() => {
    const withScore = outcomes.filter((o) => o.score_total != null);
    if (!withScore.length) return null;

    const avg = (arr) =>
      arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

    // Radar data
    const radar = [
      { signal: "Stack", value: avg(withScore.map((o) => o.score_stack).filter(Boolean)) },
      { signal: "Company", value: avg(withScore.map((o) => o.score_company).filter(Boolean)) },
      { signal: "Clarity", value: avg(withScore.map((o) => o.score_clarity).filter(Boolean)) },
    ];

    // Score distribution buckets
    const buckets = { "0–24": 0, "25–49": 0, "50–74": 0, "75–100": 0 };
    withScore.forEach(({ score_total: s }) => {
      if (s < 25) buckets["0–24"]++;
      else if (s < 50) buckets["25–49"]++;
      else if (s < 75) buckets["50–74"]++;
      else buckets["75–100"]++;
    });
    const distribution = Object.entries(buckets).map(([range, count]) => ({ range, count }));

    // Score vs interview outcome scatter
    const scatter = outcomes
      .filter((o) => o.score_total != null && o.got_interview != null)
      .map((o) => ({ score: o.score_total, outcome: o.got_interview ? 1 : 0 }));

    // Company-level aggregates (top 8 by count)
    const byCompany = {};
    withScore.forEach((o) => {
      const name = o.company_name || "Unknown";
      if (!byCompany[name]) byCompany[name] = { scores: [], interviews: 0, total: 0 };
      byCompany[name].scores.push(o.score_total);
      byCompany[name].total++;
      if (o.got_interview) byCompany[name].interviews++;
    });
    const companyBars = Object.entries(byCompany)
      .map(([name, d]) => ({
        name: name.length > 14 ? name.slice(0, 13) + "…" : name,
        avgScore: avg(d.scores),
        count: d.total,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 8);

    return { radar, distribution, scatter, companyBars };
  }, [outcomes]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <span className="text-3xl">📊</span>
        <p>Not enough data yet — view some postings first.</p>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: 8,
    color: "#f4f4f5",
    fontSize: 12,
  };

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Stats</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Signal radar */}
        <ChartCard title="Signal Averages">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={data.radar} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#3f3f46" />
              <PolarAngleAxis dataKey="signal" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
              <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Score distribution */}
        <ChartCard title="Score Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.distribution} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Postings" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Avg score by company */}
        <ChartCard title="Avg Score by Company" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.companyBars} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} />
              <Bar dataKey="avgScore" fill="#22c55e" radius={[0, 4, 4, 0]} name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Score vs outcome scatter */}
        {data.scatter.length > 0 && (
          <ChartCard title="Score vs Interview Outcome" className="lg:col-span-2">
            <p className="text-xs text-zinc-500 mb-3">Each dot is a posting you applied to. Y=1 means you got an interview.</p>
            <ResponsiveContainer width="100%" height={180}>
              <ScatterChart margin={{ top: 0, right: 20, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" dataKey="score" name="Score" domain={[0, 100]} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="outcome" name="Interview" domain={[-0.2, 1.2]} ticks={[0, 1]} tickFormatter={(v) => v === 1 ? "Yes" : "No"} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={data.scatter} fill="#3b82f6" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h2>
      {children}
    </div>
  );
}
