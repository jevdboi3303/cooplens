import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { api } from "../api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function syncUser(session) {
      if (!session) {
        localStorage.removeItem("cl_token");
        if (!cancelled) { setUser(null); setLoading(false); }
        return;
      }

      localStorage.setItem("cl_token", session.access_token);

      // Ensure user exists in our DB
      try { await api.register(); } catch { /* 409 = already exists, fine */ }

      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        // Backend unreachable — fall back to Supabase profile
        if (!cancelled) setUser({ id: session.user.id, email: session.user.email });
      }

      if (!cancelled) setLoading(false);
    }

    // onAuthStateChange fires INITIAL_SESSION on mount (handles page load + OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { syncUser(session); }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("cl_token");
    setUser(null);
  }

  return { user, loading, signOut };
}
