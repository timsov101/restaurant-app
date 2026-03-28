"use client";

import { X, Leaf, Star } from "lucide-react";

export type EatFilters = {
  cuisines: string[];                 // primary_type values
  maxPriceLevel: number | null;       // 0..4 (our DB), null = any
  minOverall: number | null;          // 1..5, null = any
  minNutrition: number | null;        // 1/3/5, null = any
  maxDistanceMiles: number | null;    // 1..10 for UI now
};

function dollarsForLevel(level: number) {
  // 0..4 -> $..$$$$$
  const n = Math.max(1, Math.min(5, level + 1));
  return "$".repeat(n);
}

function sectionTitle(icon: React.ReactNode, label: string) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 18 }}>
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function mapNutritionToLeaves(minNutrition: number | null) {
  // We store 1/3/5. Display as 1..5 leaves to mimic Figma.
  if (minNutrition == null) return 0;
  if (minNutrition === 1) return 1;
  if (minNutrition === 3) return 3;
  return 5;
}

function mapLeavesToNutrition(leaves: number) {
  // Convert 1..5 leaves back to 1/3/5 storage.
  if (leaves <= 2) return 1;
  if (leaves === 3) return 3;
  return 5;
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
  matchCount: number; // we’ll keep this so Apply can disable when 0
}) {
  if (!open) return null;

  const noMatches = matchCount === 0;

  const setCuisineAll = () => {
    setFilters({ ...filters, cuisines: cuisineOptions.map((c) => c.value) });
  };

  const clearCuisine = () => {
    setFilters({ ...filters, cuisines: [] });
  };

  const toggleCuisine = (v: string) => {
    const has = filters.cuisines.includes(v);
    setFilters({
      ...filters,
      cuisines: has ? filters.cuisines.filter((x) => x !== v) : [...filters.cuisines, v],
    });
  };

  const maxDistance = filters.maxDistanceMiles ?? 10;

  const nutritionLeaves = mapNutritionToLeaves(filters.minNutrition);
  const stars = filters.minOverall ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(17,24,39,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(860px, 100%)",
          maxHeight: "90vh",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900 }}>Filters</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 42,
              height: 42,
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

        {/* Body */}
        <div style={{ padding: 18, overflow: "auto" }}>
          {/* Cuisine */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            {sectionTitle(<span style={{ width: 18 }} />, "Cuisine")}
            <div style={{ display: "flex", gap: 14, fontWeight: 900 }}>
              <button
                type="button"
                onClick={setCuisineAll}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1d4ed8",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={clearCuisine}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6b7280",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            {cuisineOptions.map((c) => {
              const checked = filters.cuisines.includes(c.value);
              return (
                <label
                  key={c.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCuisine(c.value)}
                    style={{
                      width: 22,
                      height: 22,
                      accentColor: "#1d4ed8",
                      cursor: "pointer",
                    }}
                  />
                  {c.label}
                </label>
              );
            })}
          </div>

          <div style={{ height: 1, background: "#e5e7eb", margin: "22px 0" }} />

          {/* Max Cost */}
          {sectionTitle(<span style={{ color: "#2563eb", fontWeight: 900 }}>$</span>, "Max Cost")}
          <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[0, 1, 2, 3].map((lvl) => {
              const selected = filters.maxPriceLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilters({ ...filters, maxPriceLevel: selected ? null : lvl })}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 140,
                    padding: "18px 18px",
                    borderRadius: 14,
                    border: selected ? "2px solid #1d4ed8" : "2px solid #d1d5db",
                    background: selected ? "#1d4ed8" : "white",
                    color: selected ? "white" : "#9ca3af",
                    fontWeight: 900,
                    fontSize: 22,
                    cursor: "pointer",
                  }}
                >
                  {dollarsForLevel(lvl)}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: "#e5e7eb", margin: "22px 0" }} />

          {/* Max Distance */}
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Max Distance: {maxDistance} mi
          </div>
          <div style={{ marginTop: 12 }}>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={maxDistance}
              onChange={(e) =>
                setFilters({ ...filters, maxDistanceMiles: Number(e.target.value) })
              }
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: "#6b7280", fontWeight: 800 }}>
              <span>1 mi</span>
              <span>10 mi</span>
            </div>
          </div>

          <div style={{ height: 1, background: "#e5e7eb", margin: "22px 0" }} />

          {/* Min Nutrition */}
          {sectionTitle(<Leaf color="#16a34a" />, "Min Nutrition")}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= nutritionLeaves;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFilters({ ...filters, minNutrition: mapLeavesToNutrition(n) })}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 6,
                  }}
                  title={`Min nutrition: ${n}/5`}
                >
                  <Leaf
                    size={34}
                    color={active ? "#16a34a" : "#d1d5db"}
                    fill={active ? "#16a34a" : "transparent"}
                  />
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: "#e5e7eb", margin: "22px 0" }} />

          {/* Min Stars */}
          {sectionTitle(<Star color="#f59e0b" />, "Min Stars")}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= stars;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFilters({ ...filters, minOverall: n })}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 6,
                  }}
                  title={`Min stars: ${n}/5`}
                >
                  <Star
                    size={38}
                    color={active ? "#f59e0b" : "#d1d5db"}
                    fill={active ? "#f59e0b" : "transparent"}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 16,
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: 14,
            background: "white",
          }}
        >
          <button
            type="button"
            onClick={onReset}
            style={{
              flex: 1,
              padding: "14px 14px",
              borderRadius: 14,
              border: "2px solid #d1d5db",
              background: "white",
              fontWeight: 900,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            Reset
          </button>

          <button
            type="button"
            disabled={noMatches}
            onClick={() => {
              if (!noMatches) onClose();
            }}
            style={{
              flex: 1,
              padding: "14px 14px",
              borderRadius: 14,
              border: "2px solid #1d4ed8",
              background: noMatches ? "#e5e7eb" : "#1d4ed8",
              color: noMatches ? "#6b7280" : "white",
              fontWeight: 900,
              fontSize: 18,
              cursor: noMatches ? "default" : "pointer",
            }}
          >
            {noMatches ? "No Matches" : "Apply Filters"}
          </button>
        </div>
      </div>
    </div>
  );
}
