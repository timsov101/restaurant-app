"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { pickActiveGroupId, setStoredActiveGroupId } from "@/lib/activeGroup";
import type { ActiveGroupOption } from "@/lib/activeGroupData";
import { loadUserActiveGroups } from "@/lib/activeGroupData";
import { Search } from "lucide-react";
import ActiveGroupModal from "@/components/ActiveGroupModal";
import ActiveGroupTrigger from "@/components/ActiveGroupTrigger";
import StatePanel from "@/components/StatePanel";
import TopControlRow from "@/components/TopControlRow";
import HistoryCard, { HistoryRow } from "./HistoryCard";
import { formatCuisineLabel } from "./HistoryCuisine";
import HistoryFiltersModal, { HistoryFilters } from "./HistoryFiltersModal";

const defaultFilters: HistoryFilters = {
  cuisines: [],
};

function matchesSearch(row: HistoryRow, query: string) {
  const s = query.trim().toLowerCase();
  if (!s) return true;

  const cuisine = formatCuisineLabel(row.cuisine)?.toLowerCase() ?? "";

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
    if (!row.cuisine || !filters.cuisines.includes(row.cuisine)) return false;
  }

  return true;
}

export default function HistoryPage() {
  const [groups, setGroups] = useState<ActiveGroupOption[]>([]);
  const [groupId, setGroupId] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(defaultFilters);
  const [hasGroups, setHasGroups] = useState(true);
  const filtersActive = filters.cuisines.length > 0;
  const activeGroup = useMemo(
    () => groups.find((group) => group.id === groupId) ?? null,
    [groupId, groups]
  );

  const loadHistory = useCallback(async (nextGroupId: string) => {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase.rpc("history_for_group", {
      p_group_id: nextGroupId,
    });
    setLoading(false);

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as HistoryRow[]);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id ?? null;

        if (!userId) {
          window.location.href = "/auth?next=%2Fhistory";
          return;
        }

        const { groups: nextGroups, error } = await loadUserActiveGroups(userId);
        if (error) {
          setLoading(false);
          setErr(error);
          setRows([]);
          return;
        }

        setGroups(nextGroups);
        setHasGroups(nextGroups.length > 0);

        const activeGroupId = pickActiveGroupId(nextGroups);
        if (!activeGroupId) {
          setLoading(false);
          setRows([]);
          return;
        }

        setGroupId(activeGroupId);
      })();
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!groupId) return;

    setStoredActiveGroupId(groupId);

    const id = window.setTimeout(() => {
      void loadHistory(groupId);
    }, 0);

    return () => window.clearTimeout(id);
  }, [groupId, loadHistory]);

  const cuisineOptions = useMemo(() => {
    const entries = new Map<string, string>();

    rows.forEach((row) => {
      if (!row.cuisine) return;
      const label = formatCuisineLabel(row.cuisine);
      if (!label) return;
      entries.set(row.cuisine, label);
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

    await loadHistory(groupId);
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

      <TopControlRow
        filterActive={filtersActive}
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

      <div style={{ position: "relative", marginBottom: 12 }}>
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

      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <StatePanel loading message="Loading history..." />
      ) : !hasGroups ? (
        <StatePanel message="Join or create a group to see history." />
      ) : filtered.length === 0 ? (
        <StatePanel message="No completed dining events yet." />
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
