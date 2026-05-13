"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { pickActiveGroupId, setStoredActiveGroupId } from "@/lib/activeGroup";
import type { ActiveGroupOption } from "@/lib/activeGroupData";
import { loadUserActiveGroups } from "@/lib/activeGroupData";
import { hasDistanceUpperBound } from "@/lib/distanceFilter";
import EatFiltersModal, { EatFilters } from "./EatFiltersModal";
import ActiveGroupModal from "@/components/ActiveGroupModal";
import ActiveGroupTrigger from "@/components/ActiveGroupTrigger";
import TopControlRow from "@/components/TopControlRow";
import {
  Utensils,
  ChevronDown,
  ChevronRight,
  MapPin,
  NotebookText,
  SlidersHorizontal,
  X,
  Search as SearchIcon,
  Star,
  Leaf,
} from "lucide-react";

type Group = ActiveGroupOption;
type Member = { user_id: string; role: string; display_name: string | null };

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
  last_visit_at: string | null;
  last_visit_event_id: string | null;
  last_visit_label: string | null;
  last_visit_diner_count: number | null;
  last_visit_diner_names: string[];
};

type SavedRestaurant = {
  id: string;
  name: string;
  address: string | null;
  primary_type: string | null;
  price_level: number | null;
  group_avg_overall: number | null;
  group_avg_nutrition: number | null;
  distance_miles: number | null;
};

type RestaurantMetaRow = {
  id: string;
  primary_type: string | null;
  price_level: number | null;
};

type SavedRestaurantForGroupRow = {
  restaurant_id: string;
  name: string;
  address: string | null;
  primary_type: string | null;
  price_level: number | null;
  effective_cost_level?: number | null;
  group_avg_overall?: number | null;
  group_avg_nutrition?: number | null;
  distance_miles?: number | null;
};

type ParticipantRow = {
  user_id: string;
};

type ChosenVisitDetails = {
  label: string | null;
  dinerNames: string[];
  dinerCount: number | null;
};

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeString(entry))
      .filter((entry): entry is string => entry !== null);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function formatRelativeVisit(value: string | null) {
  if (!value) return null;

  const visitTime = new Date(value).getTime();
  if (Number.isNaN(visitTime)) return null;

  const daysAgo = Math.floor((Date.now() - visitTime) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 30) return `${Math.round(daysAgo / 7)} weeks ago`;
  return `${Math.round(daysAgo / 30)} months ago`;
}

function normalizeRecRow(row: Record<string, unknown>): RecRow {
  const lastVisitAt =
    normalizeString(row.last_visit_at) ??
    normalizeString(row.last_visited_at);

  const lastVisitLabel =
    normalizeString(row.last_visit_label) ??
    normalizeString(row.last_visit_relative_label) ??
    normalizeString(row.last_visited_label) ??
    formatRelativeVisit(lastVisitAt);

  return {
    restaurant_id: String(row.restaurant_id ?? ""),
    name: String(row.name ?? "Unknown"),
    address: normalizeString(row.address),
    price_level: normalizeNumber(row.price_level),
    overall_avg: normalizeNumber(row.overall_avg) ?? 0,
    nutrition_avg: normalizeNumber(row.nutrition_avg) ?? 0,
    recency_score: normalizeNumber(row.recency_score) ?? 0,
    cost_score: normalizeNumber(row.cost_score) ?? 0,
    final_score: normalizeNumber(row.final_score) ?? 0,
    last_visit_at: lastVisitAt,
    last_visit_event_id:
      normalizeString(row.last_visit_event_id) ??
      normalizeString(row.last_visited_event_id),
    last_visit_label: lastVisitLabel,
    last_visit_diner_count:
      normalizeNumber(row.last_visit_diner_count) ??
      normalizeNumber(row.last_visited_diner_count),
    last_visit_diner_names:
      normalizeStringArray(row.last_visit_diner_names) ??
      normalizeStringArray(row.last_visited_diner_names),
  };
}

function normalizeSavedRestaurantForGroupRow(
  row: Record<string, unknown>
): SavedRestaurant {
  return {
    id: String(row.restaurant_id ?? ""),
    name: String(row.name ?? "Unknown"),
    address: normalizeString(row.address),
    primary_type: normalizeString(row.primary_type),
    price_level:
      normalizeNumber(row.effective_cost_level) ??
      normalizeNumber(row.price_level),
    group_avg_overall: normalizeNumber(row.group_avg_overall),
    group_avg_nutrition: normalizeNumber(row.group_avg_nutrition),
    distance_miles:
      normalizeNumber(row.distance_miles) ??
      normalizeNumber(row.distanceMiles) ??
      normalizeNumber(row.distance_mi),
  };
}

const defaultFilters: EatFilters = {
  cuisines: [],
  maxPriceLevel: null,
  minOverall: null,
  minNutrition: null,
  maxDistanceMiles: null,
};

function matchesRecFilters(
  row: RecRow,
  filters: EatFilters,
  recMeta: Record<string, { primary_type: string | null; price_level: number | null }>,
  distanceByRestaurantId: Record<string, number | null>
) {
  const meta = recMeta[row.restaurant_id] ?? { primary_type: null, price_level: null };

  if (filters.cuisines.length > 0) {
    if (!meta.primary_type || !filters.cuisines.includes(meta.primary_type)) return false;
  }

  if (filters.maxPriceLevel != null) {
    if (meta.price_level != null && meta.price_level > filters.maxPriceLevel) return false;
  }

  if (filters.minOverall != null && Number(row.overall_avg) < filters.minOverall) return false;
  if (filters.minNutrition != null && Number(row.nutrition_avg) < filters.minNutrition) return false;
  if (hasDistanceUpperBound(filters.maxDistanceMiles)) {
    const distanceMiles = distanceByRestaurantId[row.restaurant_id] ?? null;
    if (distanceMiles == null || distanceMiles > filters.maxDistanceMiles) return false;
  }

  return true;
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 32,
        padding: "6px 14px",
        borderRadius: 999,
        border: selected ? "1px solid transparent" : "1px solid #93c5fd",
        background: selected
          ? "linear-gradient(90deg, #1d4ed8 0%, #2b58d0 100%)"
          : "white",
        color: selected ? "white" : "#1d4ed8",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      {label}
    </button>
  );
}

function prettyCuisine(primaryType: string | null) {
  if (!primaryType) return null;
  return primaryType
    .replace(/_restaurant$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function priceDollar(priceLevel: number | null) {
  if (priceLevel == null) return null;
  const n = Math.max(1, Math.min(4, priceLevel));
  return "$".repeat(n);
}

function metricStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    color,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.3,
  };
}

function InlineSpinner({ size = 16, color = "#6a7282" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke={color}
        strokeOpacity="0.2"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="3"
      >
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          dur="0.75s"
          from="0 12 12"
          repeatCount="indefinite"
          to="360 12 12"
          type="rotate"
        />
      </path>
    </svg>
  );
}

function PickMyOwnCard({
  restaurant,
  selected,
  choosing,
  onChoose,
}: {
  restaurant: SavedRestaurant;
  selected: boolean;
  choosing: boolean;
  onChoose: () => void;
}) {
  const cuisine = prettyCuisine(restaurant.primary_type) ?? "Cuisine";
  const metrics = [
    restaurant.group_avg_overall == null
      ? null
      : {
          key: "overall",
          label: Number(restaurant.group_avg_overall).toFixed(1).replace(/\.0$/, ""),
          icon: <Star size={14} color="#f59e0b" fill="none" strokeWidth={1.8} />,
          color: "#364153",
        },
    restaurant.group_avg_nutrition == null
      ? null
      : {
          key: "nutrition",
          label: Number(restaurant.group_avg_nutrition).toFixed(1).replace(/\.0$/, ""),
          icon: <Leaf size={14} color="#16a34a" strokeWidth={1.8} />,
          color: "#16a34a",
        },
    restaurant.price_level == null
      ? null
      : {
          key: "price",
          label: priceDollar(restaurant.price_level),
          icon: <span style={{ fontSize: 15, lineHeight: 1 }}>$</span>,
          color: "#2563eb",
        },
    restaurant.distance_miles == null
      ? null
      : {
          key: "distance",
          label: `${restaurant.distance_miles.toFixed(1)} mi`,
          icon: <MapPin size={14} color="#a855f7" strokeWidth={1.8} />,
          color: "#364153",
        },
  ].filter(Boolean) as Array<{
    key: string;
    label: string | null;
    icon: React.ReactNode;
    color: string;
  }>;

  return (
    <article
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 14,
                lineHeight: "20px",
                fontWeight: 600,
                letterSpacing: "-0.15px",
                color: "#0a0a0a",
              }}
            >
              {restaurant.name}
            </div>
            {selected ? (
              <div
                style={{
                  minHeight: 20,
                  borderRadius: 999,
                  background: "#dcfce7",
                  color: "#008236",
                  fontSize: 12,
                  lineHeight: "16px",
                  padding: "2px 8px",
                }}
              >
                Selected
              </div>
            ) : null}
          </div>

          <div
            style={{
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
              marginBottom: restaurant.address ? 2 : 12,
            }}
          >
            {cuisine}
          </div>

          {restaurant.address ? (
            <div
              style={{
                fontSize: 10,
                lineHeight: "15px",
                color: "#99a1af",
                letterSpacing: "0.12px",
                marginBottom: 12,
              }}
            >
              {restaurant.address}
            </div>
          ) : null}

          {metrics.length > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {metrics.map((metric) => (
                <div key={metric.key} style={metricStyle(metric.color)}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {metric.icon}
                  </span>
                  <span style={{ color: "#364153" }}>{metric.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onChoose}
          disabled={choosing}
          style={{
            height: 40,
            minWidth: 116,
            padding: "0 16px",
            borderRadius: 16,
            border: selected ? "none" : "2px solid #1d4ed8",
            background: selected ? "#1d4ed8" : "white",
            color: selected ? "white" : "#1d4ed8",
            fontSize: 14,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
            cursor: choosing ? "default" : "pointer",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
          title="Log that we ate here today"
        >
          <Utensils size={16} />
          {choosing ? "Saving…" : "Eat Here"}
        </button>
      </div>
    </article>
  );
}

function PickMyOwnModal({
  open,
  query,
  loading,
  restaurants,
  chosenRestaurantId,
  choosingId,
  onClose,
  onQueryChange,
  onChoose,
}: {
  open: boolean;
  query: string;
  loading: boolean;
  restaurants: SavedRestaurant[];
  chosenRestaurantId: string | null;
  choosingId: string | null;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onChoose: (restaurantId: string) => void | Promise<void>;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick your own restaurant"
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
            padding: "12px 12px 8px 12px",
            background: "white",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 8,
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
                color: "#4a5565",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <SearchIcon
              size={16}
              color="#9ca3af"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search restaurants..."
              style={{
                width: "100%",
                height: 40,
                borderRadius: 10,
                border: "1px solid transparent",
                background: "#f3f4f6",
                padding: query ? "0 44px 0 40px" : "0 12px 0 40px",
                fontSize: 16,
                letterSpacing: "-0.31px",
                color: "#111827",
                outline: "none",
              }}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  onQueryChange("");
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 28,
                  height: 28,
                  border: "none",
                  borderRadius: 999,
                  background: "transparent",
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            padding: "12px 24px 20px",
          }}
        >
          {loading ? (
            <div
              style={{
                minHeight: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: "#6a7282",
              }}
            >
              Loading restaurants...
            </div>
          ) : restaurants.length === 0 ? (
            <div
              style={{
                minHeight: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontSize: 14,
                color: "#6a7282",
                padding: "0 16px",
              }}
            >
              No restaurants found. Try a different search term.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {restaurants.map((restaurant) => (
                <PickMyOwnCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  selected={chosenRestaurantId === restaurant.id}
                  choosing={choosingId === restaurant.id}
                  onChoose={() => onChoose(restaurant.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  row,
  rank,
  cuisine,
  distanceMiles,
  selected,
  choosing,
  onChoose,
}: {
  row: RecRow;
  rank: number;
  cuisine: string;
  distanceMiles: number | null;
  selected: boolean;
  choosing: boolean;
  onChoose: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastVisitText = row.last_visit_label;
  const dinerNames = row.last_visit_diner_names;
  const dinerCount = row.last_visit_diner_count;

  const metrics = [
    {
      key: "overall",
      label: Number(row.overall_avg).toFixed(1).replace(/\.0$/, ""),
      icon: <Star size={14} color="#f59e0b" fill="none" strokeWidth={1.8} />,
      color: "#364153",
    },
    {
      key: "nutrition",
      label: Number(row.nutrition_avg).toFixed(1).replace(/\.0$/, ""),
      icon: <Leaf size={14} color="#16a34a" strokeWidth={1.8} />,
      color: "#16a34a",
    },
    row.price_level == null
      ? null
      : {
          key: "price",
          label: priceDollar(row.price_level),
          icon: <span style={{ fontSize: 15, lineHeight: 1 }}>$</span>,
          color: "#2563eb",
        },
    distanceMiles == null
      ? null
      : {
          key: "distance",
          label: `${distanceMiles.toFixed(1)} mi`,
          icon: <MapPin size={14} color="#a855f7" strokeWidth={1.8} />,
          color: "#364153",
        },
  ].filter(Boolean) as Array<{
    key: string;
    label: string | null;
    icon: React.ReactNode;
    color: string;
  }>;

  return (
    <article
      style={{
        position: "relative",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
        padding: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background:
            rank === 1
              ? "linear-gradient(90deg, #1d4ed8 0%, #1e40af 100%)"
              : "#e5e7eb",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 4,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                color: "#0a0a0a",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: rank === 1 ? "#1d4ed8" : "#99a1af",
                  marginRight: 8,
                  fontWeight: 700,
                }}
              >
                #{rank}
              </span>
              {row.name}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                minHeight: 20,
                borderRadius: 999,
                background: "#dbeafe",
                color: "#1d4ed8",
                fontSize: 12,
                lineHeight: "16px",
                padding: "2px 8px",
                fontWeight: 700,
              }}
            >
              <NotebookText size={11} strokeWidth={1.8} />
              {Math.round(Number(row.final_score))}
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
              marginBottom: 4,
            }}
          >
            {cuisine}
          </div>

          {row.address ? (
            <div
              style={{
                fontSize: 10,
                lineHeight: "15px",
                color: "#99a1af",
                letterSpacing: "0.12px",
                marginBottom: 12,
              }}
            >
              {row.address}
            </div>
          ) : (
            <div style={{ height: 15, marginBottom: 12 }} />
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {metrics.map((metric) => (
              <div key={metric.key} style={metricStyle(metric.color)}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {metric.icon}
                </span>
                <span style={{ color: "#364153" }}>{metric.label}</span>
              </div>
            ))}
          </div>

        </div>

        <button
          type="button"
          onClick={onChoose}
          disabled={choosing}
          style={{
            height: 40,
            minWidth: 112,
            padding: "0 16px",
            borderRadius: 16,
            border: selected ? "none" : "2px solid #1d4ed8",
            background: selected ? "#1d4ed8" : "white",
            color: selected ? "white" : "#1d4ed8",
            fontSize: 14,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
            cursor: choosing ? "default" : "pointer",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
          title="Log that we ate here today"
        >
          <Utensils size={16} />
          {choosing ? "Saving…" : "Eat Here"}
        </button>
      </div>

      {lastVisitText ? (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setDrawerOpen((value) => !value)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "#6a7282",
              fontSize: 12,
              lineHeight: "16px",
              fontWeight: 500,
              cursor: "pointer",
            }}
            aria-expanded={drawerOpen}
            aria-label={`Toggle last visit details for ${row.name}`}
          >
            {drawerOpen ? (
              <ChevronDown size={12} strokeWidth={2} />
            ) : (
              <ChevronRight size={12} strokeWidth={2} />
            )}
            <span>Last visit: {lastVisitText}</span>
          </button>

          {drawerOpen ? (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
              }}
            >
              <div
                style={{
                  borderTop: "1px solid #f3f4f6",
                  marginBottom: 8,
                  width: "100%",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "#6a7282",
                  }}
                >
                  {lastVisitText}
                </div>

                {dinerNames.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "flex-start",
                      alignItems: "center",
                    }}
                  >
                    {dinerNames.map((name) => (
                      <div
                        key={name}
                        style={{
                          borderRadius: 999,
                          padding: "4px 10px",
                          background: "#f3f4f6",
                          color: "#364153",
                          fontSize: 12,
                          fontWeight: 400,
                          lineHeight: 1.3,
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                ) : dinerCount != null ? (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: "16px",
                      color: "#99a1af",
                    }}
                  >
                    {dinerCount} diner{dinerCount === 1 ? "" : "s"}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function EatPage() {
  const [uid, setUid] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>(
    {}
  );

  const [eventId, setEventId] = useState<string | null>(null);
  const [chosenRestaurantId, setChosenRestaurantId] = useState<string | null>(null);

  const [chosenDetails, setChosenDetails] = useState<SavedRestaurant | null>(null);
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickedViaModal, setPickedViaModal] = useState(false);
  const [chosenVisitDetails, setChosenVisitDetails] = useState<ChosenVisitDetails | null>(null);
  const [chosenVisitDrawerOpen, setChosenVisitDrawerOpen] = useState(false);

  // Pick My Own modal state
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [savedRestaurants, setSavedRestaurants] = useState<SavedRestaurant[]>([]);

  // debounce & init guards
  const debounceTimer = useRef<number | null>(null);
  const suppressAutoRun = useRef(false);

  const [recMeta, setRecMeta] = useState<Record<string, { primary_type: string | null; price_level: number | null }>>({});

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<EatFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<EatFilters>(defaultFilters);

  const distanceByRestaurantId = useMemo(() => {
    const next: Record<string, number | null> = {};
    savedRestaurants.forEach((restaurant) => {
      next[restaurant.id] = restaurant.distance_miles ?? null;
    });
    return next;
  }, [savedRestaurants]);

  useEffect(() => {
    setVisibleCount(5);
  }, [filters]);

  const filteredRecs = useMemo(() => {
    return recs.filter((row) =>
      matchesRecFilters(row, filters, recMeta, distanceByRestaurantId)
    );
  }, [distanceByRestaurantId, filters, recMeta, recs]);

  const visible = useMemo(
    () => filteredRecs.slice(0, visibleCount),
    [filteredRecs, visibleCount]
  );

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(recMeta).forEach((m) => {
      if (m.primary_type) set.add(m.primary_type);
    });
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: prettyCuisine(v) ?? v }));
  }, [recMeta]);

  const filteredSaved = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return savedRestaurants;
    return savedRestaurants.filter((r) => {
      const cuisine = prettyCuisine(r.primary_type)?.toLowerCase() ?? "";

      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        cuisine.includes(q) ||
        (r.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [pickQuery, savedRestaurants]);

  const filtersActive = useMemo(() => {
    return (
      filters.cuisines.length > 0 ||
      filters.maxPriceLevel !== null ||
      filters.minOverall !== null ||
      filters.minNutrition !== null ||
      filters.maxDistanceMiles !== null
    );
  }, [filters]);

  const draftMatchCount = useMemo(() => {
    return recs.filter((row) =>
      matchesRecFilters(row, draftFilters, recMeta, distanceByRestaurantId)
    ).length;
  }, [distanceByRestaurantId, draftFilters, recMeta, recs]);

  const hasDistanceData = useMemo(() => {
    return recs.some((row) => distanceByRestaurantId[row.restaurant_id] != null);
  }, [distanceByRestaurantId, recs]);

  const chosenRecommendation = useMemo(() => {
    if (!pickedViaModal || !chosenRestaurantId) return null;
    return recs.find((row) => row.restaurant_id === chosenRestaurantId) ?? null;
  }, [chosenRestaurantId, pickedViaModal, recs]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === groupId) ?? null,
    [groupId, groups]
  );

  const chosenLastVisitText =
    chosenRecommendation?.last_visit_label ?? chosenVisitDetails?.label ?? null;
  const chosenLastVisitDinerNames =
    chosenRecommendation?.last_visit_diner_names ?? chosenVisitDetails?.dinerNames ?? [];
  const chosenLastVisitDinerCount =
    chosenRecommendation?.last_visit_diner_count ?? chosenVisitDetails?.dinerCount ?? null;

  function openFilters() {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
    setDraftFilters(filters);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFiltersOpen(false);
  }

  const selectedParticipantIds = useCallback(() => {
    return Object.entries(selectedMembers)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }, [selectedMembers]);

  const loadSavedRestaurantsForGroup = useCallback(async (nextGroupId: string) => {
    const { data, error } = await supabase.rpc("saved_restaurants_for_group", {
      p_group_id: nextGroupId,
    });

    if (error) throw new Error(error.message);

    return ((data ?? []) as SavedRestaurantForGroupRow[]).map((row) =>
      normalizeSavedRestaurantForGroupRow(row as unknown as Record<string, unknown>)
    );
  }, []);

  const loadChosenDetails = useCallback(async (rid: string) => {
    if (!groupId) {
      setChosenDetails(null);
      return;
    }

    const savedMatch = savedRestaurants.find((restaurant) => restaurant.id === rid) ?? null;
    if (savedMatch) {
      setChosenDetails(savedMatch);
      return;
    }

    try {
      const nextSavedRestaurants = await loadSavedRestaurantsForGroup(groupId);
      setSavedRestaurants(nextSavedRestaurants);
      setChosenDetails(
        nextSavedRestaurants.find((restaurant) => restaurant.id === rid) ?? null
      );
    } catch {
      setChosenDetails(null);
    }
  }, [groupId, loadSavedRestaurantsForGroup, savedRestaurants]);

  const loadChosenVisitDetails = useCallback(async (rid: string) => {
    const participantIds = selectedParticipantIds();
    if (participantIds.length === 0) {
      setChosenVisitDetails(null);
      return;
    }

    const { data, error } = await supabase
      .from("restaurant_visits")
      .select("user_id, last_visited_at")
      .eq("restaurant_id", rid)
      .in("user_id", participantIds)
      .order("last_visited_at", { ascending: false });

    if (error) {
      setChosenVisitDetails(null);
      return;
    }

    const visits = ((data ?? []) as Array<{ user_id: string; last_visited_at: string | null }>)
      .filter((row) => Boolean(row.last_visited_at));

    if (visits.length === 0) {
      setChosenVisitDetails(null);
      return;
    }

    const latestVisitAt = visits[0]?.last_visited_at ?? null;
    if (!latestVisitAt) {
      setChosenVisitDetails(null);
      return;
    }

    const latestVisitTime = new Date(latestVisitAt).getTime();
    const dinerNames = visits
      .filter((row) => {
        const ts = row.last_visited_at ? new Date(row.last_visited_at).getTime() : Number.NaN;
        return ts === latestVisitTime;
      })
      .map((row) => members.find((member) => member.user_id === row.user_id)?.display_name ?? null)
      .filter((name): name is string => Boolean(name));

    setChosenVisitDetails({
      label: formatRelativeVisit(latestVisitAt),
      dinerNames,
      dinerCount: dinerNames.length > 0 ? dinerNames.length : null,
    });
  }, [members, selectedParticipantIds]);

  useEffect(() => {
    if (chosenRestaurantId) {
      loadChosenDetails(chosenRestaurantId);
    } else {
      setChosenDetails(null);
      setChosenVisitDetails(null);
      setChosenVisitDrawerOpen(false);
    }
  }, [chosenRestaurantId, loadChosenDetails]);

  useEffect(() => {
    if (!pickedViaModal || !chosenRestaurantId) {
      setChosenVisitDetails(null);
      setChosenVisitDrawerOpen(false);
      return;
    }

    if (chosenRecommendation) {
      setChosenVisitDetails(null);
      setChosenVisitDrawerOpen(false);
      return;
    }

    void loadChosenVisitDetails(chosenRestaurantId);
  }, [chosenRecommendation, chosenRestaurantId, loadChosenVisitDetails, pickedViaModal]);

  async function loadRecs(eid: string) {
    const { data, error } = await supabase.rpc("recommendations_for_event", { p_event_id: eid });
    if (error) {
      setError(error.message);
      return;
    }
    const normalizedRows = ((data ?? []) as Record<string, unknown>[]).map(normalizeRecRow);
    setRecs(normalizedRows);
    const ids = normalizedRows.map((row) => row.restaurant_id);
    if (ids.length) {
      const { data: m } = await supabase
        .from("restaurants")
        .select("id, primary_type, price_level")
        .in("id", ids);

      const map: Record<string, { primary_type: string | null; price_level: number | null }> = {};
      ((m ?? []) as RestaurantMetaRow[]).forEach((row) => {
        map[row.id] = { primary_type: row.primary_type ?? null, price_level: row.price_level ?? null };
      });
      setRecMeta(map);
    } else {
      setRecMeta({});
    }
    setVisibleCount(5);
  }

  async function findRecentDraftEvent(gid: string) {
    // reuse within 3 hours, draft, no chosen restaurant
    const { data, error } = await supabase
      .from("dining_events")
      .select("id, chosen_restaurant_id, status, updated_at")
      .eq("group_id", gid)
      .eq("created_by", uid!)
      .eq("status", "draft")
      .is("chosen_restaurant_id", null)
      .gte("updated_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // not fatal; just behave as if none
      return null;
    }
    return data ?? null;
  }

  async function loadParticipantsForEvent(eid: string) {
    const { data, error } = await supabase
      .from("dining_event_participants")
      .select("user_id")
      .eq("event_id", eid);

    if (error) return null;

    return ((data ?? []) as ParticipantRow[]).map((row) => row.user_id);
  }

  async function createDraftEvent(gid: string, participantIds: string[]) {
    const { data: ev, error } = await supabase
      .from("dining_events")
      .insert({ group_id: gid, created_by: uid, status: "draft" })
      .select("id, chosen_restaurant_id")
      .single();

    if (error) throw new Error(error.message);

    const rows = participantIds.map((pid) => ({ event_id: ev.id, user_id: pid }));
    const { error: e2 } = await supabase.from("dining_event_participants").insert(rows);
    if (e2) throw new Error(e2.message);

    return { id: ev.id as string, chosen_restaurant_id: ev.chosen_restaurant_id as string | null };
  }

  async function chooseRestaurant(rid: string) {
    if (!eventId) {
      setError("No active event yet.");
      return;
    }
    setChoosingId(rid);
    setError(null);

    const { error } = await supabase.rpc("set_event_choice", {
      p_event_id: eventId,
      p_restaurant_id: rid,
    });

    setChoosingId(null);
    if (error) return setError(error.message);

    setChosenRestaurantId(rid);
  }

  async function openPickMyOwn() {
    if (!groupId) return;

    setError(null);
    setPickQuery("");
    setPickOpen(true);
    setPickLoading(true);

    try {
      const nextSavedRestaurants = await loadSavedRestaurantsForGroup(groupId);
      setSavedRestaurants(nextSavedRestaurants);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setPickLoading(false);
    }
  }

  // Initial: session + groups, auto-select last group
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id ?? null;
      if (!u) {
        window.location.href = "/auth?next=%2Feat";
        return;
      }
      setUid(u);

      const { groups: nextGroups, error } = await loadUserActiveGroups(u);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      setGroups(nextGroups);
      setLoading(false);

      const activeGroupId = pickActiveGroupId(nextGroups);
      if (activeGroupId) setGroupId(activeGroupId);
    })();
  }, []);

  // When groupId changes: load members, restore draft participants, load recs
  useEffect(() => {
    if (!uid) return;
    if (!groupId) return;

    setStoredActiveGroupId(groupId);
    setPickOpen(false);
    setPickLoading(false);
    setSavedRestaurants([]);
    setPickQuery("");
    setPickedViaModal(false);
    setChosenDetails(null);
    setChosenVisitDetails(null);
    setChosenVisitDrawerOpen(false);

    (async () => {
      setError(null);
      setLoadingMembers(true);
      setMembers([]);
      setRecs([]);
      setSavedRestaurants([]);
      setVisibleCount(5);
      setEventId(null);
      setChosenRestaurantId(null);

      const { data, error } = await supabase.rpc("members_for_group", { p_group_id: groupId });
      setLoadingMembers(false);

      if (error) {
        setError(error.message);
        return;
      }

      const ms = (data ?? []) as Member[];
      setMembers(ms);

      try {
        const nextSavedRestaurants = await loadSavedRestaurantsForGroup(groupId);
        setSavedRestaurants(nextSavedRestaurants);
      } catch (loadSavedError) {
        setError(
          loadSavedError instanceof Error
            ? loadSavedError.message
            : String(loadSavedError)
        );
      }

      // default selection: all true
      const allSel: Record<string, boolean> = {};
      ms.forEach((m) => (allSel[m.user_id] = true));

      setLoadingRecs(true);

      try {
        // Try to reuse a recent draft event (3h)
        const draft = await findRecentDraftEvent(groupId);

        if (draft?.id) {
          const eid = draft.id as string;
          setEventId(eid);
          setChosenRestaurantId(draft.chosen_restaurant_id ?? null);

          // Load stored participants for the draft and reflect in chips
          const existing = await loadParticipantsForEvent(eid);

          const sel: Record<string, boolean> = {};
          ms.forEach((m) => {
            sel[m.user_id] = existing ? existing.includes(m.user_id) : true;
          });

          suppressAutoRun.current = true;
          setSelectedMembers(sel);
          suppressAutoRun.current = false;

          // Ensure participants are set (also “touches” updated_at)
          await supabase.rpc("set_event_participants", {
            p_event_id: eid,
            p_user_ids: (existing && existing.length > 0) ? existing : Object.keys(allSel),
          });

          await loadRecs(eid);
        } else {
          // Create a new draft event using all diners selected
          const created = await createDraftEvent(groupId, Object.keys(allSel));
          setEventId(created.id);
          setChosenRestaurantId(created.chosen_restaurant_id ?? null);

          suppressAutoRun.current = true;
          setSelectedMembers(allSel);
          suppressAutoRun.current = false;

          await loadRecs(created.id);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingRecs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, uid]);

  // When selectedMembers changes: debounce update participants + rerun recs
  useEffect(() => {
    if (!uid || !groupId) return;
    if (suppressAutoRun.current) return;
    if (!eventId) return;

    const ids = selectedParticipantIds();

    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(async () => {
      setLoadingRecs(true);
      setError(null);

      const { error } = await supabase.rpc("set_event_participants", {
        p_event_id: eventId,
        p_user_ids: ids,
      });

      if (error) {
        setLoadingRecs(false);
        setError(error.message);
        return;
      }

      await loadRecs(eventId);
      setLoadingRecs(false);
    }, 400);

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMembers]);

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <TopControlRow
        filterActive={filtersActive}
        marginBottom={10}
        onFilterClick={() => {
          if (filtersOpen) closeFilters();
          else openFilters();
        }}
        trigger={
          <ActiveGroupTrigger
            activeGroup={activeGroup}
            disabled={groups.length === 0}
            onClick={() => setGroupModalOpen(true)}
          />
        }
      />

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loadingRecs ? (
        <div
          aria-label="Updating recommendations"
          role="status"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(250,250,250,0.35)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <InlineSpinner size={22} color="#4a5565" />
          </div>
        </div>
      ) : null}

      {/* Diners chips */}
      {loadingMembers ? (
        <div style={{ opacity: 0.7, marginBottom: 12 }}>Loading diners…</div>
      ) : members.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 4px 6px" }}>
            {members.map((m) => {
              const label = m.display_name ?? "Unknown";
              const selected = Boolean(selectedMembers[m.user_id]);
              return (
                <Chip
                  key={m.user_id}
                  label={label}
                  selected={selected}
                  onClick={() =>
                    setSelectedMembers((prev) => ({
                      ...prev,
                      [m.user_id]: !selected,
                    }))
                  }
                />
              );
            })}
          </div>

        </div>
      ) : null}

      {/* Your Pick card */}
      {pickedViaModal && chosenDetails && (
        <div
          style={{
            borderRadius: 16,
            padding: 18,
            background: "white",
            border: "2px solid #1d4ed8",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 16, lineHeight: "24px", fontWeight: 600, letterSpacing: "-0.31px", color: "#0a0a0a" }}>
                  {chosenDetails.name}
                </div>
                <div
                  style={{
                    minHeight: 20,
                    borderRadius: 999,
                    background: "#dcfce7",
                    color: "#008236",
                    fontSize: 12,
                    lineHeight: "16px",
                    padding: "2px 8px",
                  }}
                >
                  Your Pick
                </div>
              </div>

              <div style={{ fontSize: 12, lineHeight: "16px", color: "#6a7282", marginBottom: 4 }}>
                {prettyCuisine(chosenDetails.primary_type) ?? "Cuisine"}
              </div>

              {chosenDetails.address && (
                <div
                  style={{
                    fontSize: 10,
                    lineHeight: "15px",
                    color: "#99a1af",
                    letterSpacing: "0.12px",
                    marginBottom: 12,
                  }}
                >
                  {chosenDetails.address}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={metricStyle("#2563eb")}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1 }}>
                    $
                  </span>
                  <span style={{ color: "#364153" }}>{priceDollar(chosenDetails.price_level) ?? "—"}</span>
                </div>
                {chosenRecommendation ? (
                  <div style={metricStyle("#a855f7")}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <MapPin size={14} color="#a855f7" strokeWidth={1.8} />
                    </span>
                    <span style={{ color: "#364153" }}>Recommended</span>
                  </div>
                ) : null}
              </div>

            </div>

            <button
              type="button"
              onClick={() => chooseRestaurant(chosenDetails.id)}
              disabled={choosingId !== null}
              style={{
                height: 40,
                minWidth: 112,
                padding: "0 16px",
                borderRadius: 16,
                border: "none",
                background: "#1d4ed8",
                color: "white",
                fontSize: 14,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
                cursor: choosingId ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
              title="Log that we ate here today"
            >
              <Utensils size={18} />
              {choosingId === chosenDetails.id ? "Saving…" : "Eat Here"}
            </button>
          </div>

          {chosenLastVisitText ? (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setChosenVisitDrawerOpen((value) => !value)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#6a7282",
                  fontSize: 12,
                  lineHeight: "16px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                aria-expanded={chosenVisitDrawerOpen}
                aria-label={`Toggle last visit details for ${chosenDetails.name}`}
              >
                {chosenVisitDrawerOpen ? (
                  <ChevronDown size={12} strokeWidth={2} />
                ) : (
                  <ChevronRight size={12} strokeWidth={2} />
                )}
                <span>Last visit: {chosenLastVisitText}</span>
              </button>

              {chosenVisitDrawerOpen ? (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                  }}
                >
                  <div
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      marginBottom: 8,
                      width: "100%",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: "16px",
                        color: "#6a7282",
                      }}
                    >
                      {chosenLastVisitText}
                    </div>

                    {chosenLastVisitDinerNames.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          justifyContent: "flex-start",
                          alignItems: "center",
                        }}
                      >
                        {chosenLastVisitDinerNames.map((name) => (
                          <div
                            key={name}
                            style={{
                              borderRadius: 999,
                              padding: "4px 10px",
                              background: "#f3f4f6",
                              color: "#364153",
                              fontSize: 12,
                              fontWeight: 400,
                              lineHeight: 1.3,
                            }}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    ) : chosenLastVisitDinerCount != null ? (
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: "16px",
                          color: "#99a1af",
                        }}
                      >
                        {chosenLastVisitDinerCount} diner{chosenLastVisitDinerCount === 1 ? "" : "s"}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: "16px",
                          color: "#99a1af",
                        }}
                      >
                        Details unavailable
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visible.map((r, idx) => (
              <RecommendationCard
                key={r.restaurant_id}
                row={r}
                rank={idx + 1}
                cuisine={prettyCuisine(recMeta[r.restaurant_id]?.primary_type ?? null) ?? "Cuisine"}
                distanceMiles={distanceByRestaurantId[r.restaurant_id] ?? null}
                selected={chosenRestaurantId === r.restaurant_id}
                choosing={choosingId === r.restaurant_id}
                onChoose={() => {
                  setPickedViaModal(false);
                  chooseRestaurant(r.restaurant_id);
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.min(filteredRecs.length, c + 5))}
              disabled={visibleCount >= filteredRecs.length}
              style={{
                flex: 1,
                padding: "14px 14px",
                borderRadius: 14,
                border: "2px solid #1d4ed8",
                background: "white",
                color: "#1d4ed8",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                cursor: visibleCount >= filteredRecs.length ? "default" : "pointer",
                opacity: visibleCount >= filteredRecs.length ? 0.5 : 1,
              }}
            >
              <ChevronDown size={18} />
              See More
            </button>

            <button
              type="button"
              onClick={openPickMyOwn}
              disabled={!eventId}
              style={{
                flex: 1,
                padding: "14px 14px",
                borderRadius: 14,
                border: "2px solid #1d4ed8",
                background: "#1d4ed8",
                color: "white",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                cursor: !eventId ? "default" : "pointer",
                opacity: !eventId ? 0.55 : 1,
              }}
              title={!eventId ? "Select a group first" : "Pick from saved restaurants"}
            >
              <SlidersHorizontal size={18} />
              Pick My Own
            </button>
          </div>
        </>
      )}

      <PickMyOwnModal
        open={pickOpen}
        query={pickQuery}
        loading={pickLoading}
        restaurants={filteredSaved}
        chosenRestaurantId={chosenRestaurantId}
        choosingId={choosingId}
        onClose={() => setPickOpen(false)}
        onQueryChange={setPickQuery}
        onChoose={async (restaurantId) => {
          setPickedViaModal(true);
          await chooseRestaurant(restaurantId);
          setPickOpen(false);
        }}
      />

      <ActiveGroupModal
        open={groupModalOpen}
        groups={groups}
        activeGroupId={groupId}
        onClose={() => setGroupModalOpen(false)}
        onSelect={(nextGroupId) => {
          setGroupId(nextGroupId);
          setStoredActiveGroupId(nextGroupId);
          setGroupModalOpen(false);
        }}
      />

      <EatFiltersModal
        open={filtersOpen}
        onClose={closeFilters}
        cuisineOptions={cuisineOptions}
        filters={draftFilters}
        matchCount={draftMatchCount}
        hasDistanceData={hasDistanceData}
        onChange={setDraftFilters}
        onReset={() => setDraftFilters(defaultFilters)}
        onApply={applyFilters}
      />
    </main>
  );
}
