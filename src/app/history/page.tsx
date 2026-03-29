"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Filter, Search } from "lucide-react";
import HistoryCard, { HistoryRow } from "./HistoryCard";
import { formatCuisineLabel } from "./HistoryCuisine";
import HistoryFiltersModal, { HistoryFilters } from "./HistoryFiltersModal";

type RestaurantMetadataRow = {
  id: string;
  primary_type: string | null;
};

const defaultFilters: HistoryFilters = {
  cuisines: [],
};

function matchesSearch(row: HistoryRow, query: string) {
  const s = query.trim().toLowerCase();
  if (!s) return true;

  const cuisine = formatCuisineLabel(row.restaurant_primary_type)?.toLowerCase() ?? "";

  return (
    row.group_name.toLowerCase().includes(s) ||
    row.restaurant_name.toLowerCase().includes(s) ||
    cuisine.includes(s) ||
    (row.restaurant_address ?? "").toLowerCase().includes(s) ||
    (row.diners ?? "").toLowerCase().includes(s)
  );
}

function matchesFilters(row: HistoryRow, filters: HistoryFilters) {
  if (filters.cuisines.length > 0) {
    if (!row.restaurant_primary_type || !filters.cuisines.includes(row.restaurant_primary_type)) return false;
  }

  return true;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(defaultFilters);
  const filtersActive = filters.cuisines.length > 0;

  async function load() {
    setErr(null);
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/auth?next=%2Fhistory";
      return;
    }

    const { data, error } = await supabase.rpc("history_for_user");
    setLoading(false);

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    const historyRows = ((data ?? []) as HistoryRow[]).map((row) => ({
      ...row,
      restaurant_primary_type: null,
    }));

    const restaurantIds = Array.from(new Set(historyRows.map((row) => row.restaurant_id).filter(Boolean)));

    if (restaurantIds.length === 0) {
      setRows(historyRows);
      return;
    }

    const { data: metadata, error: metadataError } = await supabase
      .from("restaurants")
      .select("id, primary_type")
      .in("id", restaurantIds);

    if (metadataError) {
      setRows(historyRows);
      return;
    }

    const metadataById = new Map(
      ((metadata ?? []) as RestaurantMetadataRow[]).map((row) => [row.id, row.primary_type ?? null])
    );

    setRows(
      historyRows.map((row) => ({
        ...row,
        restaurant_primary_type: metadataById.get(row.restaurant_id) ?? null,
      }))
    );
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const cuisineOptions = useMemo(() => {
    const entries = new Map<string, string>();

    rows.forEach((row) => {
      if (!row.restaurant_primary_type) return;
      const label = formatCuisineLabel(row.restaurant_primary_type);
      if (!label) return;
      entries.set(row.restaurant_primary_type, label);
    });

    return Array.from(entries.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => matchesSearch(row, q) && matchesFilters(row, filters));
  }, [filters, q, rows]);

  const draftMatchCount = useMemo(() => {
    return rows.filter((row) => matchesSearch(row, q) && matchesFilters(row, draftFilters)).length;
  }, [draftFilters, q, rows]);

  async function onDelete(eventId: string) {
    const ok = window.confirm("Delete this dining event? This cannot be undone.");
    if (!ok) return;

    setDeleting(eventId);
    setErr(null);

    const { error } = await supabase.rpc("delete_event", { p_event_id: eventId });
    setDeleting(null);

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
  }

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

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>History</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            flex: 1,
            position: "relative",
          }}
        >
          <Search
            color="#9ca3af"
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search group, restaurant, cuisine, diners..."
            style={{
              width: "100%",
              height: 40,
              borderRadius: 999,
              border: "2px solid #1d4ed8",
              background: "white",
              padding: "8px 14px 8px 38px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
              outline: "none",
              fontSize: 16,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#111827",
            }}
          />
        </div>

        <button
          type="button"
          title="Filters"
          aria-label="Filters"
          aria-expanded={filtersOpen}
          aria-pressed={filtersActive}
          onClick={() => {
            if (filtersOpen) closeFilters();
            else openFilters();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "2px solid #1d4ed8",
            background: filtersActive ? "#1d4ed8" : "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          <Filter size={16} color={filtersActive ? "white" : "#1d4ed8"} />
        </button>
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <div style={{ opacity: 0.7 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No completed dining events yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((r) => {
            const isDeleting = deleting === r.event_id;

            return (
              <HistoryCard
                key={r.event_id}
                row={r}
                isDeleting={isDeleting}
                disableDelete={deleting !== null}
                onDelete={() => onDelete(r.event_id)}
              />
            );
          })}
        </div>
      )}

      <HistoryFiltersModal
        open={filtersOpen}
        filters={draftFilters}
        cuisineOptions={cuisineOptions}
        matchCount={draftMatchCount}
        onClose={closeFilters}
        onChange={setDraftFilters}
        onReset={() => setDraftFilters(defaultFilters)}
        onApply={applyFilters}
      />
    </main>
  );
}
