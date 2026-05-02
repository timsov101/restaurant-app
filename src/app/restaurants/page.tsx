"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Leaf,
  MapPin,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import { pickActiveGroupId, setStoredActiveGroupId } from "@/lib/activeGroup";
import type { ActiveGroupOption } from "@/lib/activeGroupData";
import { loadUserActiveGroups } from "@/lib/activeGroupData";
import { hasDistanceUpperBound } from "@/lib/distanceFilter";
import { supabase } from "@/lib/supabaseClient";
import ActiveGroupModal from "@/components/ActiveGroupModal";
import ActiveGroupTrigger from "@/components/ActiveGroupTrigger";
import StatePanel from "@/components/StatePanel";
import TopControlRow from "@/components/TopControlRow";
import RestaurantsFiltersModal, {
  RestaurantFilters,
  RestaurantMode,
  RestaurantSortBy,
} from "./RestaurantsFiltersModal";
import RestaurantsRatingModal from "./RestaurantsRatingModal";

type Group = ActiveGroupOption;

type SavedRestaurantRow = {
  group_id: string;
  restaurant_id: string;
  group_restaurant_id?: string | null;
  saved_at?: string | null;
  name: string;
  address: string | null;
  primary_type: string | null;
  price_level: number | null;
  group_avg_overall?: number | null;
  group_avg_nutrition?: number | null;
  current_user_overall?: number | null;
  current_user_nutrition?: number | null;
  current_user_has_rating?: boolean | null;
  current_user_rating_state?: string | null;
  distance_miles?: number | null;
};

type AddRestaurantRow = {
  place_id: string;
  restaurant_id?: string | null;
  name: string;
  address: string | null;
  primary_type: string | null;
  price_level: number | null;
  distance_miles?: number | null;
  is_saved_to_active_group: boolean;
};

type PendingDelete = {
  row: SavedRestaurantRow;
  groupId: string;
};

type RatingDraft = {
  overall: number | null;
  nutrition: number | null;
};

type AddSaveModalState = {
  row: AddRestaurantRow;
  draft: RatingDraft;
};

const defaultFilters: RestaurantFilters = {
  cuisines: [],
  maxPriceLevel: null,
  maxDistanceMiles: null,
  minNutrition: null,
  minOverall: null,
  sortBy: "name",
};

function prettyCuisine(primaryType: string | null) {
  if (!primaryType) return null;

  return primaryType
    .replace(/_restaurant$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function priceDollar(priceLevel: number | null) {
  if (priceLevel == null) return null;
  const n = Math.max(1, Math.min(5, priceLevel + 1));
  return "$".repeat(n);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSavedRow(row: Record<string, unknown>): SavedRestaurantRow {
  const hasRating =
    typeof row.current_user_has_rating === "boolean"
      ? row.current_user_has_rating
      : String(row.current_user_rating_state ?? "").toLowerCase() === "rated";

  return {
    group_id: String(row.group_id),
    restaurant_id: String(row.restaurant_id),
    group_restaurant_id:
      row.group_restaurant_id == null ? null : String(row.group_restaurant_id),
    saved_at: row.saved_at ?? null,
    name: String(row.name ?? "Unknown"),
    address: row.address ?? null,
    primary_type: row.primary_type ?? null,
    price_level: normalizeNumber(row.price_level),
    group_avg_overall: normalizeNumber(row.group_avg_overall),
    group_avg_nutrition: normalizeNumber(row.group_avg_nutrition),
    current_user_overall: normalizeNumber(row.current_user_overall),
    current_user_nutrition: normalizeNumber(row.current_user_nutrition),
    current_user_has_rating: hasRating,
    current_user_rating_state: row.current_user_rating_state ?? null,
    distance_miles:
      normalizeNumber(row.distance_miles) ??
      normalizeNumber(row.distanceMiles) ??
      normalizeNumber(row.distance_mi),
  };
}

function normalizeAddRow(row: Record<string, unknown>): AddRestaurantRow {
  return {
    place_id: String(row.place_id ?? row.placeId ?? ""),
    restaurant_id:
      row.restaurant_id == null ? null : String(row.restaurant_id),
    name: String(row.name ?? "Unknown"),
    address:
      row.address == null
        ? row.formatted_address == null
          ? null
          : String(row.formatted_address)
        : String(row.address),
    primary_type: row.primary_type == null ? null : String(row.primary_type),
    price_level: normalizeNumber(row.price_level),
    distance_miles:
      normalizeNumber(row.distance_miles) ??
      normalizeNumber(row.distanceMiles) ??
      normalizeNumber(row.distance_mi),
    is_saved_to_active_group:
      typeof row.is_saved_to_active_group === "boolean"
        ? row.is_saved_to_active_group
        : Boolean(row.is_saved_to_active_group),
  };
}

function matchesSearch(row: SavedRestaurantRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const cuisine = prettyCuisine(row.primary_type)?.toLowerCase() ?? "";

  return (
    row.name.toLowerCase().includes(q) ||
    cuisine.includes(q) ||
    (row.address ?? "").toLowerCase().includes(q)
  );
}

function matchesFilters(
  row: SavedRestaurantRow,
  filters: RestaurantFilters,
  hasDistanceData: boolean
) {
  if (filters.cuisines.length > 0) {
    if (!row.primary_type || !filters.cuisines.includes(row.primary_type)) {
      return false;
    }
  }

  if (filters.maxPriceLevel != null) {
    if (row.price_level != null && row.price_level > filters.maxPriceLevel) {
      return false;
    }
  }

  if (filters.minNutrition != null) {
    if (
      row.group_avg_nutrition == null ||
      Number(row.group_avg_nutrition) < filters.minNutrition
    ) {
      return false;
    }
  }

  if (filters.minOverall != null) {
    if (row.group_avg_overall == null || Number(row.group_avg_overall) < filters.minOverall) {
      return false;
    }
  }

  if (hasDistanceData && hasDistanceUpperBound(filters.maxDistanceMiles)) {
    if (
      row.distance_miles == null ||
      Number(row.distance_miles) > filters.maxDistanceMiles
    ) {
      return false;
    }
  }

  return true;
}

function compareNullableNumbersDesc(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function compareNullableNumbersAsc(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function sortRows(
  rows: SavedRestaurantRow[],
  sortBy: RestaurantSortBy,
  hasDistanceData: boolean
) {
  const collator = new Intl.Collator(undefined, {
    sensitivity: "base",
    numeric: true,
  });

  return [...rows].sort((a, b) => {
    if (sortBy === "rating") {
      const diff = compareNullableNumbersDesc(a.group_avg_overall, b.group_avg_overall);
      return diff !== 0 ? diff : collator.compare(a.name, b.name);
    }

    if (sortBy === "nutrition") {
      const diff = compareNullableNumbersDesc(
        a.group_avg_nutrition,
        b.group_avg_nutrition
      );
      return diff !== 0 ? diff : collator.compare(a.name, b.name);
    }

    if (sortBy === "cost") {
      const diff = compareNullableNumbersAsc(a.price_level, b.price_level);
      return diff !== 0 ? diff : collator.compare(a.name, b.name);
    }

    if (sortBy === "distance") {
      const diff = hasDistanceData
        ? compareNullableNumbersAsc(a.distance_miles, b.distance_miles)
        : 0;
      return diff !== 0 ? diff : collator.compare(a.name, b.name);
    }

    if (sortBy === "unrated") {
      const aUnrated = !a.current_user_has_rating;
      const bUnrated = !b.current_user_has_rating;

      if (aUnrated !== bUnrated) return aUnrated ? -1 : 1;
      return collator.compare(a.name, b.name);
    }

    return collator.compare(a.name, b.name);
  });
}

function isFiltersActive(filters: RestaurantFilters) {
  return (
    filters.cuisines.length > 0 ||
    filters.maxPriceLevel !== null ||
    filters.maxDistanceMiles !== null ||
    filters.minNutrition !== null ||
    filters.minOverall !== null ||
    filters.sortBy !== "name"
  );
}

function sanitizeFiltersForMode(
  mode: RestaurantMode,
  filters: RestaurantFilters
): RestaurantFilters {
  if (mode === "saved") return filters;

  return {
    ...filters,
    minNutrition: null,
    minOverall: null,
    sortBy:
      filters.sortBy === "rating" ||
      filters.sortBy === "nutrition" ||
      filters.sortBy === "unrated"
        ? "name"
        : filters.sortBy,
  };
}

function isAddSearchActive(filters: RestaurantFilters, query: string) {
  const effective = sanitizeFiltersForMode("add", filters);

  return (
    query.trim() !== "" ||
    effective.cuisines.length > 0 ||
    effective.maxPriceLevel !== null ||
    effective.maxDistanceMiles !== null ||
    effective.sortBy !== "name"
  );
}

function buildCuisineOptions(rows: Array<{ primary_type: string | null }>) {
  const entries = new Map<string, string>();

  rows.forEach((row) => {
    if (!row.primary_type) return;
    const label = prettyCuisine(row.primary_type);
    if (!label) return;
    entries.set(row.primary_type, label);
  });

  return Array.from(entries.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

const addCuisineOptions = [
  "american_restaurant",
  "barbecue_restaurant",
  "breakfast_restaurant",
  "brunch_restaurant",
  "chinese_restaurant",
  "fast_food_restaurant",
  "greek_restaurant",
  "indian_restaurant",
  "italian_restaurant",
  "japanese_restaurant",
  "korean_restaurant",
  "mediterranean_restaurant",
  "mexican_restaurant",
  "pizza_restaurant",
  "seafood_restaurant",
  "steak_house",
  "sushi_restaurant",
  "thai_restaurant",
  "vegan_restaurant",
  "vegetarian_restaurant",
  "vietnamese_restaurant",
].map((value) => ({
  value,
  label: prettyCuisine(value) ?? value,
}));

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

function RemoveToast({
  name,
  onUndo,
}: {
  name: string;
  onUndo: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 96,
        transform: "translateX(-50%)",
        width: "min(calc(100vw - 24px), 360px)",
        zIndex: 60,
        background: "white",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 12px",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#0a0a0a",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          flex: "0 0 auto",
        }}
      >
        ✓
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          lineHeight: 1.5,
          fontWeight: 500,
          color: "#0a0a0a",
        }}
      >
        {name} removed from your library
      </div>
      <button
        type="button"
        onClick={onUndo}
        style={{
          border: "none",
          borderRadius: 4,
          background: "#0a0a0a",
          color: "white",
          height: 24,
          padding: "0 10px",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          flex: "0 0 auto",
        }}
      >
        Undo
      </button>
    </div>
  );
}

function SavedRestaurantCard({
  row,
  removing,
  onRate,
  onRemove,
}: {
  row: SavedRestaurantRow;
  removing: boolean;
  onRate: () => void;
  onRemove: () => void;
}) {
  const cuisine = prettyCuisine(row.primary_type) ?? "Cuisine";
  const dollars = priceDollar(row.price_level);
  const isRated = Boolean(row.current_user_has_rating);

  const metrics = [
    row.group_avg_overall == null
      ? null
      : {
          key: "overall",
          label: Number(row.group_avg_overall).toFixed(1).replace(/\.0$/, ""),
          icon: (
            <Star
              size={14}
              color="#f59e0b"
              fill="none"
              strokeWidth={1.8}
            />
          ),
          color: "#364153",
        },
    row.group_avg_nutrition == null
      ? null
      : {
          key: "nutrition",
          label: Number(row.group_avg_nutrition).toFixed(1).replace(/\.0$/, ""),
          icon: (
            <Leaf
              size={14}
              color="#16a34a"
              strokeWidth={1.8}
            />
          ),
          color: "#16a34a",
        },
    dollars == null
      ? null
      : {
          key: "price",
          label: dollars,
          icon: <span style={{ fontSize: 15, lineHeight: 1 }}>$</span>,
          color: "#2563eb",
        },
    row.distance_miles == null
      ? null
      : {
          key: "distance",
          label: `${row.distance_miles.toFixed(1)} mi`,
          icon: <MapPin size={14} color="#a855f7" strokeWidth={1.8} />,
          color: "#364153",
        },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    color: string;
  }>;

  return (
    <article
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
        padding: 16,
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
                fontSize: 16,
                lineHeight: 1.5,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                color: "#0a0a0a",
              }}
            >
              {row.name}
            </div>
            {!isRated ? (
              <div
                style={{
                  minHeight: 20,
                  borderRadius: 999,
                  background: "#f3f4f6",
                  color: "#4a5565",
                  fontSize: 12,
                  lineHeight: "16px",
                  padding: "2px 8px",
                }}
              >
                Unrated
              </div>
            ) : null}
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
                <div
                  key={metric.key}
                  style={metricStyle(metric.color)}
                >
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
          <button
            type="button"
            onClick={onRate}
            title={isRated ? "Update rating" : "Rate restaurant"}
            aria-label={isRated ? `Update rating for ${row.name}` : `Rate ${row.name}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isRated ? "#f59e0b" : "#94a3b8",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Star
              size={20}
              fill={isRated ? "#f59e0b" : "none"}
              strokeWidth={1.8}
            />
          </button>

          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            title="Remove from group"
            aria-label={`Remove ${row.name} from this group`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: "#99a1af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: removing ? "default" : "pointer",
              opacity: removing ? 0.45 : 1,
            }}
          >
            <Trash2 size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </article>
  );
}

function AddRestaurantCard({
  row,
  saving,
  onSave,
}: {
  row: AddRestaurantRow;
  saving: boolean;
  onSave: () => void;
}) {
  const cuisine = prettyCuisine(row.primary_type) ?? "Cuisine";
  const dollars = priceDollar(row.price_level);

  const metrics = [
    dollars == null
      ? null
      : {
          key: "price",
          label: dollars,
          icon: <span style={{ fontSize: 15, lineHeight: 1 }}>$</span>,
          color: "#2563eb",
        },
    row.distance_miles == null
      ? null
      : {
          key: "distance",
          label: `${row.distance_miles.toFixed(1)} mi`,
          icon: <MapPin size={14} color="#a855f7" strokeWidth={1.8} />,
          color: "#364153",
        },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    color: string;
  }>;

  const buttonDisabled = row.is_saved_to_active_group || saving;

  return (
    <article
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
        padding: 16,
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
              fontSize: 16,
              lineHeight: 1.5,
              fontWeight: 600,
              letterSpacing: "-0.31px",
              color: "#0a0a0a",
              marginBottom: 4,
            }}
          >
            {row.name}
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
                <div
                  key={metric.key}
                  style={metricStyle(metric.color)}
                >
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
          onClick={onSave}
          disabled={buttonDisabled}
          aria-label={
            row.is_saved_to_active_group
              ? `${row.name} is already saved`
              : `Save ${row.name}`
          }
          style={{
            height: 40,
            minWidth: row.is_saved_to_active_group ? 96 : 88,
            borderRadius: 16,
            border: "none",
            background: row.is_saved_to_active_group ? "#f3f4f6" : "#00a63e",
            color: row.is_saved_to_active_group ? "#6a7282" : "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
            padding: "0 16px",
            fontSize: 14,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: buttonDisabled ? "default" : "pointer",
            opacity: saving && !row.is_saved_to_active_group ? 0.85 : 1,
            flex: "0 0 auto",
          }}
        >
          {row.is_saved_to_active_group ? (
            <Check size={16} strokeWidth={2} />
          ) : (
            <Bookmark size={16} strokeWidth={1.8} />
          )}
          <span>{row.is_saved_to_active_group ? "Saved" : saving ? "Saving…" : "Save"}</span>
        </button>
      </div>
    </article>
  );
}

export default function RestaurantsPage() {
  const [mode, setMode] = useState<RestaurantMode>("saved");
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadingAddRows, setLoadingAddRows] = useState(false);
  const [hasGroups, setHasGroups] = useState(true);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [rows, setRows] = useState<SavedRestaurantRow[]>([]);
  const [addRows, setAddRows] = useState<AddRestaurantRow[]>([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<RestaurantFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<RestaurantFilters>(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [draftAddMatchCount, setDraftAddMatchCount] = useState<number | null>(null);
  const [ratingRow, setRatingRow] = useState<SavedRestaurantRow | null>(null);
  const [ratingDraft, setRatingDraft] = useState<RatingDraft>({
    overall: null,
    nutrition: null,
  });
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [addSaveModal, setAddSaveModal] = useState<AddSaveModalState | null>(null);
  const [addSaveError, setAddSaveError] = useState<string | null>(null);

  const deleteTimerRef = useRef<number | null>(null);
  const lastAddResultsKeyRef = useRef<string | null>(null);

  const savedHasDistanceData = useMemo(
    () => rows.some((row) => row.distance_miles != null),
    [rows]
  );
  const addHasDistanceData = useMemo(
    () => addRows.some((row) => row.distance_miles != null),
    [addRows]
  );
  const effectiveFilters = useMemo(
    () => sanitizeFiltersForMode(mode, filters),
    [filters, mode]
  );
  const effectiveDraftFilters = useMemo(
    () => sanitizeFiltersForMode(mode, draftFilters),
    [draftFilters, mode]
  );
  const hasDistanceData = mode === "saved" ? savedHasDistanceData : addHasDistanceData;
  const addSearchActive = useMemo(
    () => isAddSearchActive(effectiveFilters, query),
    [effectiveFilters, query]
  );
  const addDraftSearchActive = useMemo(
    () => isAddSearchActive(effectiveDraftFilters, query),
    [effectiveDraftFilters, query]
  );

  const cuisineOptions = useMemo(() => {
    return mode === "saved" ? buildCuisineOptions(rows) : addCuisineOptions;
  }, [mode, rows]);

  const visibleRows = useMemo(() => {
    const next = rows.filter(
      (row) =>
        matchesSearch(row, query) &&
        matchesFilters(row, effectiveFilters, hasDistanceData)
    );

    return sortRows(next, effectiveFilters.sortBy, hasDistanceData);
  }, [effectiveFilters, hasDistanceData, query, rows]);

  const draftMatchCount = useMemo(() => {
    if (mode === "add") {
      if (!addDraftSearchActive) return 1;
      return draftAddMatchCount ?? addRows.length;
    }

    const next = rows.filter(
      (row) =>
        matchesSearch(row, query) &&
        matchesFilters(row, effectiveDraftFilters, hasDistanceData)
    );

    return sortRows(next, effectiveDraftFilters.sortBy, hasDistanceData).length;
  }, [
    addDraftSearchActive,
    addRows.length,
    draftAddMatchCount,
    effectiveDraftFilters,
    hasDistanceData,
    mode,
    query,
    rows,
  ]);

  const filtersActive = useMemo(
    () => isFiltersActive(effectiveFilters),
    [effectiveFilters]
  );

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === groupId) ?? null,
    [groupId, groups]
  );

  async function loadSavedRestaurants(nextGroupId: string) {
    setLoadingRows(true);
    setError(null);

    const { data, error: loadError } = await supabase.rpc(
      "saved_restaurants_for_group",
      {
        p_group_id: nextGroupId,
      }
    );

    setLoadingRows(false);

    if (loadError) {
      setRows([]);
      setError(loadError.message);
      return;
    }

    setRows(
      ((data ?? []) as Record<string, unknown>[]).map(normalizeSavedRow)
    );
  }

  const buildAddSearchParams = useCallback((nextFilters: RestaurantFilters) => {
    const params = new URLSearchParams();
    params.set("groupId", groupId);

    if (query.trim()) {
      params.set("q", query.trim());
    }

    nextFilters.cuisines.forEach((cuisine) => {
      params.append("cuisines", cuisine);
    });

    if (nextFilters.maxPriceLevel != null) {
      params.set("maxPriceLevel", String(nextFilters.maxPriceLevel));
    }

    if (hasDistanceUpperBound(nextFilters.maxDistanceMiles)) {
      params.set("maxDistanceMiles", String(nextFilters.maxDistanceMiles));
    }

    if (nextFilters.sortBy !== "name") {
      params.set("sortBy", nextFilters.sortBy);
    }

    if (activeGroup?.location_lat != null && activeGroup.location_lng != null) {
      params.set("anchorLat", String(activeGroup.location_lat));
      params.set("anchorLng", String(activeGroup.location_lng));
    }

    return params;
  }, [activeGroup, groupId, query]);

  const buildAddSearchKey = useCallback(
    (nextFilters: RestaurantFilters) => buildAddSearchParams(nextFilters).toString(),
    [buildAddSearchParams]
  );

  const loadAddRestaurants = useCallback(async (nextFilters: RestaurantFilters, preview = false) => {
    if (!groupId) {
      if (!preview) {
        setLoadingAddRows(false);
        setAddRows([]);
      }
      return 0;
    }

    if (!isAddSearchActive(nextFilters, query)) {
      if (preview) return 1;
      setAddRows([]);
      setLoadingAddRows(false);
      return 0;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;

    if (!accessToken) {
      if (!preview) {
        setError("Not signed in.");
        setAddRows([]);
      }
      return 0;
    }

    if (!preview) {
      setLoadingAddRows(true);
      setError(null);
    }

    const response = await fetch(`/api/places/search?${buildAddSearchParams(nextFilters)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      error?: string;
      results?: Record<string, unknown>[];
    };

    if (!response.ok) {
      if (!preview) {
        setLoadingAddRows(false);
        setAddRows([]);
        setError(payload.error ?? "Unable to search restaurants.");
      }
      return 0;
    }

    const nextRows = (payload.results ?? []).map(normalizeAddRow);

    if (!preview) {
      setLoadingAddRows(false);
      setAddRows(nextRows);
      lastAddResultsKeyRef.current = buildAddSearchKey(nextFilters);
    }

    return nextRows.length;
  }, [buildAddSearchKey, buildAddSearchParams, groupId, query]);

  async function finalizeDelete(entry: PendingDelete) {
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    setPendingDelete(null);
    setRemovingId(entry.row.restaurant_id);

    const { error: removeError } = await supabase
      .from("group_restaurants")
      .delete()
      .eq("group_id", entry.groupId)
      .eq("restaurant_id", entry.row.restaurant_id);

    setRemovingId(null);

    if (removeError) {
      setError(removeError.message);
      await loadSavedRestaurants(entry.groupId);
    }
  }

  function undoDelete() {
    if (!pendingDelete) return;

    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    const restoreGroupId = pendingDelete.groupId;
    setPendingDelete(null);
    void loadSavedRestaurants(restoreGroupId);
  }

  function queueDelete(row: SavedRestaurantRow) {
    if (!groupId) return;

    if (pendingDelete) {
      void finalizeDelete(pendingDelete);
    }

    setError(null);
    setRows((prev) => prev.filter((entry) => entry.restaurant_id !== row.restaurant_id));

    const nextPending = { row, groupId };
    setPendingDelete(nextPending);

    deleteTimerRef.current = window.setTimeout(() => {
      void finalizeDelete(nextPending);
    }, 5000);
  }

  function openFilters() {
    setDraftFilters(effectiveFilters);
    setDraftAddMatchCount(null);
    setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
    setDraftFilters(effectiveFilters);
    setDraftAddMatchCount(null);
  }

  function applyFilters() {
    setFilters(effectiveDraftFilters);
    setFiltersOpen(false);
  }

  function openRatingModal(row: SavedRestaurantRow) {
    setRatingRow(row);
    setRatingDraft({
      overall: row.current_user_overall ?? null,
      nutrition: row.current_user_nutrition ?? null,
    });
    setRatingError(null);
  }

  function closeRatingModal() {
    if (ratingSaving) return;
    setRatingRow(null);
    setRatingDraft({
      overall: null,
      nutrition: null,
    });
    setRatingError(null);
  }

  async function saveRating() {
    if (!ratingRow || !groupId) return;

    setRatingSaving(true);
    setRatingError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id ?? null;

    if (!uid) {
      setRatingSaving(false);
      setRatingError("Not signed in.");
      return;
    }

    if (ratingDraft.overall == null && ratingDraft.nutrition == null) {
      setRatingSaving(false);
      setRatingError("Select an overall or nutrition rating before saving.");
      return;
    }

    const { error: saveError } = await supabase
      .from("restaurant_ratings")
      .upsert({
        restaurant_id: ratingRow.restaurant_id,
        user_id: uid,
        overall: ratingDraft.overall,
        nutrition: ratingDraft.nutrition,
      });

    if (saveError) {
      setRatingSaving(false);
      setRatingError(saveError.message);
      return;
    }

    await loadSavedRestaurants(groupId);
    setRatingSaving(false);
    closeRatingModal();
  }

  function openAddSaveModal(row: AddRestaurantRow) {
    if (row.is_saved_to_active_group) return;

    setAddSaveModal({
      row,
      draft: {
        overall: null,
        nutrition: null,
      },
    });
    setAddSaveError(null);
  }

  function closeAddSaveModal() {
    if (savingPlaceId) return;
    setAddSaveModal(null);
    setAddSaveError(null);
  }

  async function saveAddRestaurant(
    row: AddRestaurantRow,
    rating?: RatingDraft | null
  ) {
    if (!groupId || row.is_saved_to_active_group) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;

    if (!accessToken) {
      setError("Not signed in.");
      return;
    }

    setSavingPlaceId(row.place_id);
    setError(null);
    setAddSaveError(null);

    const response = await fetch("/api/places/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        groupId,
        placeId: row.place_id,
        rating:
          rating && (rating.overall != null || rating.nutrition != null)
            ? rating
            : null,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      restaurant_id?: string | null;
    };

    setSavingPlaceId(null);

    if (!response.ok) {
      const message = payload.error ?? "Unable to save restaurant.";
      setError(message);
      setAddSaveError(message);
      return;
    }

    setAddRows((prev) =>
      prev.map((entry) =>
        entry.place_id === row.place_id
          ? {
              ...entry,
              restaurant_id: payload.restaurant_id ?? entry.restaurant_id ?? null,
              is_saved_to_active_group: true,
            }
          : entry
      )
    );

    await loadSavedRestaurants(groupId);
    setAddSaveModal(null);
    setAddSaveError(null);
  }

  async function saveAddWithoutRating() {
    if (!addSaveModal) return;
    await saveAddRestaurant(addSaveModal.row, null);
  }

  async function saveAddWithRating() {
    if (!addSaveModal) return;
    await saveAddRestaurant(addSaveModal.row, addSaveModal.draft);
  }

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;

      if (!uid) {
        window.location.href = "/auth?next=%2Frestaurants";
        return;
      }

      const { groups: nextGroups, error } = await loadUserActiveGroups(uid);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      setGroups(nextGroups);
      setHasGroups(nextGroups.length > 0);

      const activeGroupId = pickActiveGroupId(nextGroups);
      if (activeGroupId) {
        setGroupId(activeGroupId);
      } else {
        setRows([]);
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!groupId) return;

    setStoredActiveGroupId(groupId);

    const timeoutId = window.setTimeout(() => {
      void loadSavedRestaurants(groupId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [groupId]);

  useEffect(() => {
    if (mode !== "add") return;
    if (addSearchActive) {
      const requestKey = buildAddSearchKey(effectiveFilters);
      if (lastAddResultsKeyRef.current === requestKey) {
        return;
      }
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const count = await loadAddRestaurants(effectiveFilters);
        if (cancelled) return;
        if (!addSearchActive && count === 0) {
          setAddRows([]);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [addSearchActive, buildAddSearchKey, effectiveFilters, loadAddRestaurants, mode]);

  useEffect(() => {
    if (!filtersOpen || mode !== "add") return;

    if (!addDraftSearchActive) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const count = await loadAddRestaurants(effectiveDraftFilters, true);
        if (!cancelled) {
          setDraftAddMatchCount(count);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [addDraftSearchActive, effectiveDraftFilters, filtersOpen, loadAddRestaurants, mode]);

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main
      style={{
        padding: 12,
        maxWidth: 900,
        margin: "0 auto",
        background: "#fafafa",
        minHeight: "calc(100vh - 88px)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TopControlRow
          filterActive={filtersActive}
          filterAccentColor="#2563eb"
          marginBottom={0}
          onFilterClick={() => {
            if (filtersOpen) closeFilters();
            else openFilters();
          }}
          trigger={
            <ActiveGroupTrigger
              activeGroup={activeGroup}
              disabled={!hasGroups}
              onClick={() => setGroupModalOpen(true)}
            />
          }
        />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: "#f3f4f6",
            }}
          >
            <button
              type="button"
              aria-pressed={mode === "saved"}
              onClick={() => setMode("saved")}
              style={{
                height: 32,
                minWidth: 78,
                border: "none",
                borderRadius: 999,
                background: mode === "saved" ? "#1d4ed8" : "transparent",
                color: mode === "saved" ? "white" : "#4a5565",
                fontSize: 14,
                fontWeight: 500,
                padding: "0 16px",
                boxShadow:
                  mode === "saved"
                    ? "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)"
                    : "none",
                cursor: mode === "saved" ? "default" : "pointer",
              }}
            >
              Saved
            </button>
            <button
              type="button"
              aria-pressed={mode === "add"}
              onClick={() => setMode("add")}
              style={{
                height: 32,
                minWidth: 58,
                border: "none",
                borderRadius: 999,
                background: mode === "add" ? "#1d4ed8" : "transparent",
                color: mode === "add" ? "white" : "#4a5565",
                fontSize: 14,
                fontWeight: 500,
                padding: "0 16px",
                boxShadow:
                  mode === "add"
                    ? "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)"
                    : "none",
                cursor: mode === "add" ? "default" : "pointer",
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <Search
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "add"
                ? "Search or filter for restaurants"
                : "Search your restaurants..."
            }
            style={{
              width: "100%",
              height: 40,
              borderRadius: 999,
              border: "2px solid #2563eb",
              background: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
              padding: "0 14px 0 40px",
              fontSize: 16,
              letterSpacing: "-0.31px",
              color: "#111827",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {error ? (
          <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>
        ) : null}

        {!hasGroups ? (
          <StatePanel message="Join or create a group to see saved restaurants." />
        ) : (
          <>
            {mode === "saved" ? (
              loadingRows ? (
                <StatePanel loading message="Loading restaurants..." />
              ) : rows.length === 0 ? (
                <StatePanel message="No restaurants saved" />
              ) : visibleRows.length === 0 ? (
                <StatePanel message="No restaurants found. Try adjusting your filters." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {visibleRows.map((row) => (
                    <SavedRestaurantCard
                      key={row.group_restaurant_id ?? row.restaurant_id}
                      row={row}
                      removing={removingId === row.restaurant_id}
                      onRate={() => openRatingModal(row)}
                      onRemove={() => queueDelete(row)}
                    />
                  ))}
                </div>
              )
            ) : loadingAddRows ? (
              <StatePanel loading message="Searching restaurants..." />
            ) : !addSearchActive ? null
            : addRows.length === 0 ? (
              <StatePanel message="No restaurants found. Try a different search term or adjust your filters." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {addRows.map((row) => (
                  <AddRestaurantCard
                    key={row.place_id}
                    row={row}
                    saving={savingPlaceId === row.place_id}
                    onSave={() => openAddSaveModal(row)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {pendingDelete ? (
        <RemoveToast
          name={pendingDelete.row.name}
          onUndo={undoDelete}
        />
      ) : null}

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

      <RestaurantsFiltersModal
        open={filtersOpen}
        mode={mode}
        filters={effectiveDraftFilters}
        cuisineOptions={cuisineOptions}
        matchCount={draftMatchCount}
        hasDistanceData={hasDistanceData}
        onClose={closeFilters}
        onChange={setDraftFilters}
        onReset={() =>
          setDraftFilters(sanitizeFiltersForMode(mode, defaultFilters))
        }
        onApply={applyFilters}
      />

      <RestaurantsRatingModal
        open={mode === "saved" && ratingRow !== null}
        restaurantName={ratingRow?.name ?? ""}
        draft={ratingDraft}
        saving={ratingSaving}
        error={ratingError}
        onClose={closeRatingModal}
        onChange={setRatingDraft}
        onSave={saveRating}
      />

      <RestaurantsRatingModal
        open={addSaveModal !== null}
        restaurantName={addSaveModal?.row.name ?? ""}
        draft={addSaveModal?.draft ?? { overall: null, nutrition: null }}
        saving={Boolean(savingPlaceId)}
        error={addSaveError}
        closeLabel="Cancel"
        primaryLabel="Save with Rating"
        secondaryLabel="Skip & Save"
        onClose={closeAddSaveModal}
        onChange={(draft) =>
          setAddSaveModal((current) => (current ? { ...current, draft } : current))
        }
        onSave={saveAddWithRating}
        onSecondaryAction={saveAddWithoutRating}
      />
    </main>
  );
}
