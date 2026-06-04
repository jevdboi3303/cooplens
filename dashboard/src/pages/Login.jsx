import { useState } from "react";
import { supabase } from "../supabase";

export function Login() {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (tab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      // on success, onAuthStateChange in useAuth handles the redirect
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Check your email to confirm your account, then sign in.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-80 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Coop<span className="text-blue-500">Lens</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Score smarter. Apply better.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
          {["signin", "signup"].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setInfo(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === t ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="you@uvic.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-zinc-100"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />}
            {tab === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        {info  && <p className="text-xs text-zinc-400 text-center">{info}</p>}

        <div className="flex items-center gap-2 text-zinc-600 text-xs">
          <div className="flex-1 h-px bg-zinc-800" />
          <span>or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
            <path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.6 37 26.9 38 24 38c-6 0-10.6-3.9-11.8-9.2l-7 5.4C8.1 41.8 15.5 46 24 46z"/>
            <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.6-2.4 4.8-4.6 6.3l6.7 5.5C41.8 36.8 45 30.9 45 24c0-1.3-.2-2.7-.5-4z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

