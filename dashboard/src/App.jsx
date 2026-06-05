import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useOutcomes } from "./hooks/useOutcomes";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { Postings } from "./pages/Postings";
import { Outcomes } from "./pages/Outcomes";
import { Stats } from "./pages/Stats";
import { Login } from "./pages/Login";
import { Privacy } from "./pages/Privacy";

function AuthenticatedApp({ user, signOut }) {
  const { outcomes, loading: outcomesLoading, markOffer } = useOutcomes();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} onSignOut={signOut} />
      <main className="flex-1 px-8 py-8 max-w-5xl scrollbar-thin overflow-y-auto">
        {outcomesLoading ? (
          <div className="flex items-center gap-3 text-zinc-500 text-sm mt-20 justify-center">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            Loading your data…
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Overview outcomes={outcomes} />} />
            <Route path="/postings" element={<Postings outcomes={outcomes} />} />
            <Route path="/outcomes" element={<Outcomes outcomes={outcomes} markOffer={markOffer} />} />
            <Route path="/stats" element={<Stats outcomes={outcomes} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm gap-3">
        <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
        Loading…
      </div>
    );
  }

  // Privacy page is public — no auth needed
  if (window.location.pathname === "/privacy") return <Privacy />;

  if (!user) return <Login />;

  return <AuthenticatedApp user={user} signOut={signOut} />;
}
