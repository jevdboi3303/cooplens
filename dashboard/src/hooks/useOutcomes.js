import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

export function useOutcomes() {
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.outcomes();
      setOutcomes(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function markOffer(id, got_offer) {
    await api.updateOutcome(id, { got_offer });
    setOutcomes((prev) =>
      prev.map((o) => (o.id === id ? { ...o, got_offer } : o))
    );
  }

  return { outcomes, loading, error, refetch: fetch, markOffer };
}
