import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { api } from "../api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync with current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        localStorage.setItem("cl_token", session.access_token);
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          setUser({ email: session.user.email });
        }
      }
      setLoading(false);
    });

    // Keep token fresh on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          localStorage.setItem("cl_token", session.access_token);
          if (event === "SIGNED_IN") {
            try { await api.register(); } catch { /* 409 = already registered */ }
            try {
              const me = await api.me();
              setUser(me);
            } catch {
              setUser({ email: session.user.email });
            }
          }
        } else {
          localStorage.removeItem("cl_token");
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("cl_token");
    setUser(null);
  }

  return { user, loading, signOut };
}
