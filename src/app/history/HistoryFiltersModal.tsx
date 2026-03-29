"use client";

import { useEffect } from "react";
import { Soup, X } from "lucide-react";

export type HistoryFilters = {
  cuisines: string[];
};

type CuisineOption = {
  value: string;
  label: string;
};

type HistoryFiltersModalProps = {
  open: boolean;
  filters: HistoryFilters;
  cuisineOptions: CuisineOption[];
  matchCount: number;
  onClose: () => void;
  onChange: (filters: HistoryFilters) => void;
  onReset: () => void;
  onApply: () => void;
};

function sectionTitle(icon: React.ReactNode, label: string) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#0a0a0a" }}>
      <span style={{ display: "inline-flex", color: "#f97316" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function HistoryFiltersModal({
  open,
  filters,
  cuisineOptions,
  matchCount,
  onClose,
  onChange,
  onReset,
  onApply,
}: HistoryFiltersModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const noMatches = matchCount === 0;

  const setCuisineAll = () => {
    onChange({ ...filters, cuisines: cuisineOptions.map((option) => option.value) });
  };

  const clearCuisine = () => {
    onChange({ ...filters, cuisines: [] });
  };

  const toggleCuisine = (value: string) => {
    const next = filters.cuisines.includes(value)
      ? filters.cuisines.filter((entry) => entry !== value)
      : [...filters.cuisines, value];

    onChange({ ...filters, cuisines: next });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="History filters"
      onClick={onClose}
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
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(392px, 100%)",
          maxHeight: "min(763px, calc(100vh - 32px))",
          background: "#fafafa",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            height: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 16,
            background: "white",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            overflow: "auto",
            padding: "16px 24px 20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
                {sectionTitle(<Soup size={16} />, "Cuisine")}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={setCuisineAll}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#1d4ed8",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      padding: "6px 8px",
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
                      color: "#4a5565",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      padding: "6px 8px",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  background: "white",
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {cuisineOptions.length > 0 ? (
                  cuisineOptions.map((option) => {
                    const checked = filters.cuisines.includes(option.value);

                    return (
                      <label
                        key={option.value}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          minHeight: 36,
                          padding: "0 8px",
                          borderRadius: 10,
                          cursor: "pointer",
                          color: "#0a0a0a",
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCuisine(option.value)}
                          style={{
                            width: 20,
                            height: 20,
                            margin: 0,
                            accentColor: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        />
                        {option.label}
                      </label>
                    );
                  })
                ) : (
                  <div style={{ gridColumn: "1 / -1", padding: "8px 8px 12px", fontSize: 14, color: "#6a7282" }}>
                    No cuisines available yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            padding: "16px 24px",
            background: "white",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onReset}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 10,
              border: "2px solid rgba(0,0,0,0.08)",
              background: "#fafafa",
              color: "#0a0a0a",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset
          </button>

          <button
            type="button"
            disabled={noMatches}
            onClick={() => {
              if (!noMatches) onApply();
            }}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: noMatches ? "#d1d5dc" : "#1d4ed8",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              opacity: noMatches ? 0.5 : 1,
              cursor: noMatches ? "default" : "pointer",
            }}
          >
            {noMatches ? "No matches" : "Apply Filters"}
          </button>
        </div>
      </div>
    </div>
  );
}
