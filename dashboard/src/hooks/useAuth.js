import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { api } from "../api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.access_token) {
          localStorage.setItem("cl_token", session.access_token);
          try {
            const me = await api.me();
            if (!cancelled) setUser(me);
          } catch {
            // Backend unreachable or user not registered yet — use Supabase profile
            if (!cancelled) setUser({ email: session.user.email, id: session.user.id });
          }
        }
      } catch (e) {
        console.error("Session load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (session?.access_token) {
          localStorage.setItem("cl_token", session.access_token);

          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            try { await api.register(); } catch { /* 409 = already registered */ }
            try {
              const me = await api.me();
              if (!cancelled) setUser(me);
            } catch {
              if (!cancelled) setUser({ email: session.user.email, id: session.user.id });
            }
          }
        } else if (event === "SIGNED_OUT") {
          localStorage.removeItem("cl_token");
          if (!cancelled) setUser(null);
        }

        if (!cancelled) setLoading(false);
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
