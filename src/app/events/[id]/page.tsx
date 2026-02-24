"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type RecRow = {
  restaurant_id: string;
  name: string;
  address: string | null;
  price_level: number | null;
  overall_avg: number;
  nutrition_avg: number;
  recency_score: number;
  cost_score: number;
  final_score: number;
};

export default function EventPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id;

  const [uid, setUid] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [list, setList] = useState<RecRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosingId, setChoosingId] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id ?? null;
      if (!u) {
        window.location.href = `/auth?next=${encodeURIComponent(`/events/${eventId}`)}`;
        return;
      }
      setUid(u);
    })();
  }, [eventId]);

  async function loadAll() {
    if (!eventId) return;
    setError(null);
    setLoading(true);

    // Load chosen restaurant for this event (creator only can set it, but members can read event)
    const { data: ev, error: e1 } = await supabase
      .from("dining_events")
      .select("chosen_restaurant_id")
      .eq("id", eventId)
      .single();

    if (e1) {
      setLoading(false);
      return setError(e1.message);
    }

    setChosen(ev?.chosen_restaurant_id ?? null);

    // Load recommendations via RPC (group-aware, uses defaults internally)
    const { data, error: e2 } = await supabase.rpc("recommendations_for_event", {
      p_event_id: eventId,
    });

    setLoading(false);

    if (e2) return setError(e2.message);

    setList((data ?? []) as RecRow[]);
  }

  useEffect(() => {
    if (uid) loadAll();
  }, [uid]);

  const visible = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);

  async function choose(restaurantId: string) {
    if (!eventId) return;
    setChoosingId(restaurantId);
    setError(null);

    const { error } = await supabase.rpc("set_event_choice", {
      p_event_id: eventId,
      p_restaurant_id: restaurantId,
    });

    setChoosingId(null);

    if (error) return setError(error.message);

    setChosen(restaurantId);
  }

  return (
    <main style={{ padding: 24, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Recommendations</h1>

      <div style={{ opacity: 0.75, marginBottom: 14 }}>
        Showing top {Math.min(visibleCount, list.length)} of {list.length}
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : list.length === 0 ? (
        <p>No restaurants found. Add some on /restaurants first.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map((r, idx) => {
              const isChosen = chosen === r.restaurant_id;

              return (
                <div
                  key={r.restaurant_id}
                  style={{
                    border: "1px solid #e3e3e3",
                    borderRadius: 10,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 800 }}>
                        #{idx + 1} {r.name}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        score: {Number(r.final_score).toFixed(1)}
                      </div>
                    </div>
                    {r.address && (
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                        {r.address}
                      </div>
                    )}

                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>
                        Why this score?
                      </summary>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
                        Overall avg: {Number(r.overall_avg).toFixed(2)} (40%)<br />
                        Recency (variety): {Number(r.recency_score).toFixed(1)} (30%)<br />
                        Nutrition avg: {Number(r.nutrition_avg).toFixed(2)} (15%)<br />
                        Cost score: {Number(r.cost_score).toFixed(1)} (15%)
                      </div>
                    </details>
                  </div>

                  <button
                    type="button"
                    onClick={() => choose(r.restaurant_id)}
                    disabled={choosingId !== null}
                    title="Log that we ate here today"
                    style={{
                      width: 110,
                      height: 64,
                      borderRadius: 10,
                      border: "1px solid #999",
                      cursor: choosingId ? "default" : "pointer",
                      background: "white",
                      opacity: isChosen ? 1 : 0.35,   // <-- your opacity treatment
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 20 }}>🍴</div>
                    <div style={{ fontSize: 12 }}>
                      {choosingId === r.restaurant_id ? "Saving…" : "Eat Here"}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {visibleCount < list.length && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(list.length, c + 10))}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #999",
                  cursor: "pointer",
                }}
              >
                Show More
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
