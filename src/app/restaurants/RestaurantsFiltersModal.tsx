"use client";

import { useEffect } from "react";
import {
  ChevronDown,
  DollarSign,
  Leaf,
  MapPin,
  Soup,
  Star,
  X,
} from "lucide-react";

import {
  DISTANCE_FILTER_STOPS,
  formatDistanceFilterLabel,
  getDistanceFilterIndex,
  getDistanceFilterValue,
} from "@/lib/distanceFilter";

export type RestaurantMode = "saved" | "add";

export type RestaurantSortBy =
  | "name"
  | "rating"
  | "nutrition"
  | "cost"
  | "distance"
  | "unrated";

export type RestaurantFilters = {
  cuisines: string[];
  maxPriceLevel: number | null;
  maxDistanceMiles: number | null;
  minNutrition: number | null;
  minOverall: number | null;
  sortBy: RestaurantSortBy;
};

export type SavedSortBy = RestaurantSortBy;
export type SavedFilters = RestaurantFilters;

type CuisineOption = {
  value: string;
  label: string;
};

type RestaurantsFiltersModalProps = {
  open: boolean;
  mode?: RestaurantMode;
  filters: RestaurantFilters;
  cuisineOptions: CuisineOption[];
  matchCount: number;
  hasDistanceData: boolean;
  onClose: () => void;
  onChange: (filters: RestaurantFilters) => void;
  onReset: () => void;
  onApply: () => void;
};

function dollarsForLevel(level: number) {
  const n = Math.max(1, Math.min(4, level));
  return "$".repeat(n);
}

function sectionTitle(icon: React.ReactNode, label: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
        color: "#0a0a0a",
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function RestaurantsFiltersModal({
  open,
  mode = "saved",
  filters,
  cuisineOptions,
  matchCount,
  hasDistanceData,
  onClose,
  onChange,
  onReset,
  onApply,
}: RestaurantsFiltersModalProps) {
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
  const distanceIndex = getDistanceFilterIndex(filters.maxDistanceMiles);
  const maxDistanceLabel = formatDistanceFilterLabel(filters.maxDistanceMiles);
  const addMode = mode === "add";

  const setCuisineAll = () => {
    onChange({
      ...filters,
      cuisines: cuisineOptions.map((option) => option.value),
    });
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
      aria-label="Restaurant filters"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(17,24,39,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(392px, 100%)",
          maxHeight: "min(766px, calc(100vh - 24px))",
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
            height: 38,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <section
              style={{
                paddingTop: 6,
                borderTop: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minHeight: 32,
                }}
              >
                {sectionTitle(<Soup size={16} color="#f97316" />, "Cuisine")}
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
                  cuisineOptions.map((option) => (
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
                        checked={filters.cuisines.includes(option.value)}
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
                  ))
                ) : (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      padding: "8px",
                      fontSize: 14,
                      color: "#6a7282",
                    }}
                  >
                    No cuisines available yet.
                  </div>
                )}
              </div>
            </section>

            <section
              style={{
                paddingTop: 16,
                borderTop: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {sectionTitle(
                <DollarSign size={16} color="#2563eb" />,
                addMode ? "Cost" : "Max Cost"
              )}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                }}
              >
                {[1, 2, 3, 4].map((level) => {
                  const selected = filters.maxPriceLevel === level;

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...filters,
                          maxPriceLevel: selected ? null : level,
                        })
                      }
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 10,
                        border: selected
                          ? "1.892px solid #1d4ed8"
                          : "1.892px solid #d1d5dc",
                        background: selected ? "#1d4ed8" : "white",
                        color: selected ? "white" : "#4a5565",
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {dollarsForLevel(level)}
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              style={{
                paddingTop: 16,
                borderTop: "1px solid rgba(0,0,0,0.08)",
                opacity: hasDistanceData ? 1 : 0.45,
              }}
            >
              {sectionTitle(
                <MapPin size={16} color="#a855f7" />,
                hasDistanceData
                  ? `Max Distance: ${maxDistanceLabel}`
                  : "Max Distance: unavailable"
              )}
              <div style={{ marginTop: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={DISTANCE_FILTER_STOPS.length - 1}
                  step={1}
                  value={distanceIndex}
                  disabled={!hasDistanceData}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      maxDistanceMiles: getDistanceFilterValue(
                        Number(event.target.value)
                      ),
                    })
                  }
                  style={{
                    width: "100%",
                    accentColor: "#1d4ed8",
                    cursor: hasDistanceData ? "pointer" : "default",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    color: "#6a7282",
                    fontSize: 12,
                    lineHeight: "16px",
                  }}
                >
                  <span>{formatDistanceFilterLabel(DISTANCE_FILTER_STOPS[0])}</span>
                  <span>
                    {formatDistanceFilterLabel(
                      DISTANCE_FILTER_STOPS[DISTANCE_FILTER_STOPS.length - 1]
                    )}
                  </span>
                </div>
                {!hasDistanceData ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      lineHeight: "16px",
                      color: "#6a7282",
                    }}
                  >
                    Distance will be enabled once location data is available.
                  </div>
                ) : null}
              </div>
            </section>

            {addMode ? null : (
              <section
                style={{
                  paddingTop: 16,
                  borderTop: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                {sectionTitle(<Leaf size={16} color="#16a34a" />, "Min Nutrition")}
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  {[
                    { value: null, label: "Any" },
                    { value: 3, label: "Good" },
                    { value: 5, label: "Great" },
                  ].map((option) => {
                    const selected = filters.minNutrition === option.value;

                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filters,
                            minNutrition: option.value,
                          })
                        }
                        style={{
                          flex: 1,
                          height: 48,
                          borderRadius: 10,
                          border: selected
                            ? "1.892px solid #00a63e"
                            : "1.892px solid #d1d5dc",
                          background: selected ? "#00a63e" : "white",
                          color: selected ? "white" : "#4a5565",
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Leaf
                          size={16}
                          color={selected ? "white" : "#00a63e"}
                          fill={selected ? "white" : "transparent"}
                        />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {addMode ? null : (
              <section
                style={{
                  paddingTop: 16,
                  borderTop: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                {sectionTitle(<Star size={16} color="#f59e0b" />, "Min Stars")}
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = (filters.minOverall ?? 0) >= value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filters,
                            minOverall:
                              filters.minOverall === value ? null : value,
                          })
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Star
                          size={28}
                          color={active ? "#f59e0b" : "#cbd5e1"}
                          fill={active ? "#f59e0b" : "transparent"}
                          strokeWidth={1.8}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section
              style={{
                paddingTop: 16,
                borderTop: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#0a0a0a",
                }}
              >
                Sort By
              </div>
              <div style={{ marginTop: 12, position: "relative" }}>
                <select
                  value={filters.sortBy}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      sortBy: event.target.value as RestaurantFilters["sortBy"],
                    })
                  }
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid transparent",
                    background: "#f3f3f5",
                    padding: "0 40px 0 12px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#0a0a0a",
                    appearance: "none",
                  }}
                >
                  <option value="name">Name</option>
                  {addMode ? null : <option value="rating">Rating</option>}
                  {addMode ? null : <option value="nutrition">Nutrition</option>}
                  <option value="cost">Cost</option>
                  <option value="distance" disabled={!hasDistanceData}>
                    Distance
                  </option>
                  {addMode ? null : <option value="unrated">Unrated</option>}
                </select>
                <ChevronDown
                  size={16}
                  color="#9ca3af"
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                />
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
              border: "1.892px solid rgba(0,0,0,0.08)",
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
