"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Suggestion = {
  placePrediction?: {
    placeId: string;
    text?: { text: string };
  };
};

type PlaceDetailsResult = {
  place_id: string;
  name: string | null;
  formatted_address: string | null;
  price_level: string | null;
  primary_type: string | null;
  types: string[];
  price_range: {
    currencyCode: string | null;
    startUnits: number | null;
    startNanos: number | null;
    endUnits: number | null;
    endNanos: number | null;
  } | null;
};

function mapPriceLevel(priceLevel: string | null): number | null {
  if (!priceLevel) return null;
  // Places API (New) enums commonly: PRICE_LEVEL_UNSPECIFIED, FREE, INEXPENSIVE, MODERATE, EXPENSIVE, VERY_EXPENSIVE
  const v = priceLevel.toUpperCase();
  if (v.includes("FREE")) return 0;
  if (v.includes("INEXPENSIVE")) return 1;
  if (v.includes("MODERATE")) return 2;
  if (v.includes("EXPENSIVE") && !v.includes("VERY")) return 3;
  if (v.includes("VERY_EXPENSIVE")) return 4;
  return null;
}

export default function RestaurantsPage() {
  const [sessionOk, setSessionOk] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);

  const [selected, setSelected] = useState<PlaceDetailsResult | null>(null);
  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // simple debouncer
  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/auth?next=%2Frestaurants";
        return;
      }
      setSessionOk(true);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      setSelected(null);

      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoadingSug(true);
      try {
        const resp = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(debouncedQuery)}`
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error ?? "Autocomplete error");
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoadingSug(false);
      }
    }

    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [debouncedQuery]);

  async function pick(placeId: string) {
    setError(null);
    setSelected(null);

    try {
      const resp = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(placeId)}`
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? "Details error");
      setSelected(data.result as PlaceDetailsResult);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  async function loadSaved() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, google_place_id, name, address, price_level, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      setError(error.message);
      return;
    }
    setSaved(data ?? []);
  }

  useEffect(() => {
    if (sessionOk) loadSaved();
  }, [sessionOk]);

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const payload = {
      google_place_id: selected.place_id,
      name: selected.name ?? "Unknown",
      address: selected.formatted_address ?? null,
      price_level: mapPriceLevel(selected.price_level),

      primary_type: selected.primary_type ?? null,
      types: selected.types ?? [],

      price_currency: selected.price_range?.currencyCode ?? null,
      price_range_start:
        selected.price_range?.startUnits == null
          ? null
          : Number(selected.price_range.startUnits) + Number(selected.price_range.startNanos ?? 0) / 1e9,
      price_range_end:
        selected.price_range?.endUnits == null
          ? null
          : Number(selected.price_range.endUnits) + Number(selected.price_range.endNanos ?? 0) / 1e9,
    };

    const { error } = await supabase.from("restaurants").insert(payload);

    setSaving(false);

    if (error) {
      // If it's a unique violation (already saved), just reload list
      if (String(error.message).toLowerCase().includes("duplicate")) {
        await loadSaved();
        return;
      }
      setError(error.message);
      return;
    }

    await loadSaved();
    alert("Saved!");
  }

  if (!sessionOk) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Restaurants</h1>

      <section style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Search</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a restaurant name…"
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          {loadingSug ? "Searching…" : suggestions.length ? `${suggestions.length} suggestions` : ""}
        </div>
      </section>

      {error && (
        <p style={{ color: "crimson", marginTop: 8, marginBottom: 8 }}>{error}</p>
      )}

      {suggestions.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Suggestions
          </div>
          <div style={{ border: "1px solid #e3e3e3", borderRadius: 10 }}>
            {suggestions.map((s, idx) => {
              const pid = s.placePrediction?.placeId;
              const label = s.placePrediction?.text?.text ?? pid ?? "Unknown";
              if (!pid) return null;

              return (
                <button
                  key={pid + idx}
                  type="button"
                  onClick={() => pick(pid)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: idx === suggestions.length - 1 ? "none" : "1px solid #eee",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selected && (
        <section
          style={{
            marginBottom: 18,
            padding: 14,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {selected.name ?? "Unknown"}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            {selected.formatted_address ?? ""}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Price: {selected.price_level ?? "Unknown"} (stored as {String(mapPriceLevel(selected.price_level))})
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Cuisine type: {selected.primary_type ?? "Unknown"}
          </div>

          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Price range:{" "}
            {selected.price_range?.startUnits != null && selected.price_range?.endUnits != null
              ? `${selected.price_range.startUnits}–${selected.price_range.endUnits} ${selected.price_range.currencyCode ?? ""}`.trim()
              : "Unknown"}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={saveSelected}
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #999",
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save restaurant"}
          </button>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Saved (latest 25)</h2>
        {saved.length === 0 ? (
          <p>No restaurants saved yet.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {saved.map((r) => (
              <li key={r.id} style={{ marginBottom: 8 }}>
                <strong>{r.name}</strong>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{r.address}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  price_level: {r.price_level ?? "null"} | place_id: {r.google_place_id}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
