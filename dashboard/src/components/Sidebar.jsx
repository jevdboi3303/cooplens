import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", icon: "⬛" },
  { to: "/postings", label: "Postings", icon: "📋" },
  { to: "/outcomes", label: "Outcomes", icon: "🎯" },
  { to: "/stats", label: "Stats", icon: "📊" },
];

export function Sidebar({ user, onSignOut }) {
  return (
    <aside className="flex flex-col w-56 shrink-0 border-r border-zinc-800 bg-zinc-900 h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-xl font-bold tracking-tight">
          Coop<span className="text-blue-500">Lens</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white font-semibold"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
              }`
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="px-4 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 truncate mb-2">{user.email}</p>
          <button
            onClick={onSignOut}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
