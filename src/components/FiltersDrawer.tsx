"use client";

import { X } from "lucide-react";

export type EatFilters = {
  cuisines: string[];
  maxPriceLevel: number | null;
  minOverall: number | null;
  minNutrition: number | null;
  maxDistanceMiles: number | null;
};

function pillStyle(selected: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: selected ? "1px solid #1d4ed8" : "1px solid #e5e7eb",
    background: selected ? "#1d4ed8" : "white",
    color: selected ? "white" : "#111827",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer" as const,
    whiteSpace: "nowrap" as const,
  };
}

function dollarsForLevel(level: number) {
  const n = Math.max(1, Math.min(5, level + 1));
  return "$".repeat(n);
}

export default function FiltersDrawer({
  open,
  onClose,
  cuisineOptions,
  filters,
  setFilters,
  onReset,
  matchCount,
}: {
  open: boolean;
  onClose: () => void;
  cuisineOptions: { value: string; label: string }[];
  filters: EatFilters;
  setFilters: (f: EatFilters) => void;
  onReset: () => void;
  matchCount: number;
}) {
  if (!open) return null;

  const toggleCuisine = (v: string) => {
    const has = filters.cuisines.includes(v);
    setFilters({
      ...filters,
      cuisines: has ? filters.cuisines.filter((x) => x !== v) : [...filters.cuisines, v],
    });
  };

  const noMatches = matchCount === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(17,24,39,0.55)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "white",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: 16,
          paddingBottom: `calc(16px + env(safe-area-inset-bottom))`,
          boxShadow: "0 -20px 40px rgba(0,0,0,0.15)",
          maxHeight: "82vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Filters</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Close"
            title="Close"
          >
            <X />
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Matches: <span style={{ fontWeight: 900 }}>{matchCount}</span>
        </div>

        {/* Cuisine */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 8 }}>Cuisine</div>
          {cuisineOptions.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>No cuisine tags available yet.</div>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {cuisineOptions.map((c) => {
                const selected = filters.cuisines.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCuisine(c.value)}
                    style={pillStyle(selected)}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Max cost */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 8 }}>Max Cost</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, maxPriceLevel: null })}
              style={pillStyle(filters.maxPriceLevel === null)}
            >
              Any
            </button>
            {[0, 1, 2, 3, 4].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilters({ ...filters, maxPriceLevel: lvl })}
                style={pillStyle(filters.maxPriceLevel === lvl)}
              >
                {dollarsForLevel(lvl)}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Uses Google’s price level (not always available).
          </div>
        </div>

        {/* Minimum overall */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 8 }}>Minimum Overall</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, minOverall: null })}
              style={pillStyle(filters.minOverall === null)}
            >
              Any
            </button>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFilters({ ...filters, minOverall: n })}
                style={pillStyle(filters.minOverall === n)}
              >
                ★ {n}+
              </button>
            ))}
          </div>
        </div>

        {/* Minimum nutrition */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 8 }}>Minimum Nutrition</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, minNutrition: null })}
              style={pillStyle(filters.minNutrition === null)}
            >
              Any
            </button>
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFilters({ ...filters, minNutrition: n })}
                style={pillStyle(filters.minNutrition === n)}
              >
                ❧ {n}+
              </button>
            ))}
          </div>
        </div>

        {/* Distance (UI only for now) */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 8 }}>Max Distance</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Coming next — we’ll compute distance once we add a location source.
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              flex: 1,
              padding: "14px 14px",
              borderRadius: 14,
              border: "2px solid #1d4ed8",
              background: "white",
              color: "#1d4ed8",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => {
              if (!noMatches) onClose();
            }}
            disabled={noMatches}
            style={{
              flex: 1,
              padding: "14px 14px",
              borderRadius: 14,
              border: "2px solid #1d4ed8",
              background: noMatches ? "#e5e7eb" : "#1d4ed8",
              color: noMatches ? "#6b7280" : "white",
              fontWeight: 900,
              cursor: noMatches ? "default" : "pointer",
              opacity: noMatches ? 0.9 : 1,
            }}
          >
            {noMatches ? "No Matches" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
