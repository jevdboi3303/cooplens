import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { api } from "../api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;

        if (!session) {
          localStorage.removeItem("cl_token");
          setUser(null);
          setLoading(false);
          return;
        }

        // Show dashboard immediately using Supabase session — don't wait for backend
        localStorage.setItem("cl_token", session.access_token);
        setUser({ id: session.user.id, email: session.user.email });
        setLoading(false);

        // Hydrate full user profile from backend in background
        try { await api.register(); } catch { /* 409 = already registered */ }
        try {
          const me = await api.me();
          if (!cancelled) setUser(me);
        } catch { /* backend unreachable — Supabase profile is enough */ }
      }
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
