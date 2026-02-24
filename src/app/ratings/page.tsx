"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Restaurant = {
  id: string;
  name: string;
  address: string | null;
};

type RatingRow = {
  restaurant_id: string;
  overall: number | null;
  nutrition: number | null; // 1/3/5
};

const DEFAULT_OVERALL = 4;
const DEFAULT_NUTRITION = 3;

function Stars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const v = value ?? 0;

  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= v;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={`Set overall to ${n}`}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: "18px",
              padding: 0,
              opacity: filled ? 1 : 0.35,
            }}
          >
            ★
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(null)}
        style={{
          marginLeft: 8,
          fontSize: 12,
          padding: "3px 6px",
          borderRadius: 6,
          border: "1px solid #ccc",
          cursor: "pointer",
          background: "#fafafa",
        }}
        title="Clear rating"
      >
        Clear
      </button>
    </div>
  );
}

export default function RatingsPage() {
  const [sessionOk, setSessionOk] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/auth?next=%2Fratings";
        return;
      }
      setSessionOk(true);
    })();
  }, []);

  async function loadData() {
    setError(null);

    const { data: rData, error: rErr } = await supabase
      .from("restaurants")
      .select("id, name, address")
      .order("created_at", { ascending: false })
      .limit(100);

    if (rErr) {
      setError(rErr.message);
      return;
    }

    setRestaurants((rData ?? []) as Restaurant[]);

    const { data: ratData, error: ratErr } = await supabase
      .from("restaurant_ratings")
      .select("restaurant_id, overall, nutrition");

    if (ratErr) {
      setError(ratErr.message);
      return;
    }

    const map: Record<string, RatingRow> = {};
    for (const row of (ratData ?? []) as RatingRow[]) {
      map[row.restaurant_id] = row;
    }
    setRatings(map);
  }

  useEffect(() => {
    if (sessionOk) loadData();
  }, [sessionOk]);

  function getOverall(id: string) {
    return ratings[id]?.overall ?? null;
  }

  function getNutrition(id: string) {
    return ratings[id]?.nutrition ?? null;
  }

  function effectiveOverall(id: string) {
    const v = getOverall(id);
    return v ?? DEFAULT_OVERALL;
  }

  function effectiveNutrition(id: string) {
    const v = getNutrition(id);
    return v ?? DEFAULT_NUTRITION;
  }

  async function upsertRating(restaurantId: string, patch: Partial<RatingRow>) {
    setError(null);
    setSavingId(restaurantId);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      setSavingId(null);
      setError("Not signed in.");
      return;
    }

    const current = ratings[restaurantId] ?? {
      restaurant_id: restaurantId,
      overall: null,
      nutrition: null,
    };

    const next = { ...current, ...patch };

    const { error } = await supabase
      .from("restaurant_ratings")
      .upsert({
        restaurant_id: restaurantId,
        user_id: uid,
        overall: next.overall,
        nutrition: next.nutrition,
      });

    setSavingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setRatings((prev) => ({ ...prev, [restaurantId]: next }));
  }

  if (!sessionOk) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Ratings</h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Defaults when unrated: overall = {DEFAULT_OVERALL}, nutrition = {DEFAULT_NUTRITION}.
      </p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {restaurants.length === 0 ? (
        <p>No restaurants saved yet. Go to /restaurants first.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {restaurants.map((r) => {
            const overall = getOverall(r.id);
            const nutrition = getNutrition(r.id);

            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid #e3e3e3",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
                {r.address && (
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {r.address}
                  </div>
                )}

                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Overall (1–5)
                    </div>
                    <Stars
                      value={overall}
                      onChange={(v) => upsertRating(r.id, { overall: v })}
                    />
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Stored: {overall ?? "null"} | Used in scoring: {effectiveOverall(r.id)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Nutrition (1 / 3 / 5)
                    </div>
                    <select
                      value={nutrition ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        upsertRating(r.id, { nutrition: v });
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="">Select…</option>
                      <option value={1}>1 — Less healthy</option>
                      <option value={3}>3 — Neutral</option>
                      <option value={5}>5 — More healthy</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => upsertRating(r.id, { nutrition: null })}
                      style={{
                        marginLeft: 10,
                        fontSize: 12,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fafafa",
                        cursor: "pointer",
                      }}
                      title="Clear nutrition rating"
                    >
                      Clear
                    </button>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Stored: {nutrition ?? "null"} | Used in scoring: {effectiveNutrition(r.id)}
                    </div>
                  </div>
                </div>

                {savingId === r.id && (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    Saving…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
