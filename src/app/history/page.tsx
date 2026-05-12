"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { pickActiveGroupId, setStoredActiveGroupId } from "@/lib/activeGroup";
import type { ActiveGroupOption } from "@/lib/activeGroupData";
import { loadUserActiveGroups } from "@/lib/activeGroupData";
import { Plus, Search, X } from "lucide-react";
import ActiveGroupModal from "@/components/ActiveGroupModal";
import ActiveGroupTrigger from "@/components/ActiveGroupTrigger";
import StatePanel from "@/components/StatePanel";
import TopControlRow from "@/components/TopControlRow";
import HistoryCard, { HistoryRow } from "./HistoryCard";
import { formatCuisineLabel } from "./HistoryCuisine";
import HistoryFiltersModal, { HistoryFilters } from "./HistoryFiltersModal";
import ManualAddHistoryEventModal from "./ManualAddHistoryEventModal";

const defaultFilters: HistoryFilters = {
  cuisines: [],
};

type DeleteConfirmation = {
  eventId: string;
} | null;

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
  const [userId, setUserId] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(defaultFilters);
  const [hasGroups, setHasGroups] = useState(true);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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
        const uid = sessionData.session?.user?.id ?? null;

        if (!uid) {
          window.location.href = "/auth?next=%2Fhistory";
          return;
        }

        setUserId(uid);

        const { groups: nextGroups, error } = await loadUserActiveGroups(uid);
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

  function requestDelete(row: HistoryRow) {
    setDeleteConfirmation({
      eventId: row.event_id,
    });
  }

  async function confirmDelete() {
    if (!deleteConfirmation) return;

    const eventId = deleteConfirmation.eventId;
    setDeleteConfirmation(null);
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

  function cancelDelete() {
    setDeleteConfirmation(null);
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

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
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
            ref={searchInputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search group, restaurant, cuisine, diners..."
            style={{
              width: "100%",
              height: 40,
              borderRadius: 999,
              border: "2px solid #1d4ed8",
              background: "white",
              padding: q ? "8px 44px 8px 38px" : "8px 14px 8px 38px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
              outline: "none",
              fontSize: 16,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#111827",
            }}
          />
          {q ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
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

        <button
          type="button"
          onClick={() => {
            setErr(null);
            setManualAddOpen(true);
          }}
          disabled={!hasGroups || !groupId}
          style={{
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "#1d4ed8",
            color: "white",
            padding: "0 14px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
            cursor: !hasGroups || !groupId ? "default" : "pointer",
            opacity: !hasGroups || !groupId ? 0.55 : 1,
          }}
        >
          <Plus size={16} />
          <span>Add event</span>
        </button>
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
            const canDelete =
              userId != null && (r.created_by === userId || activeGroup?.owner_id === userId);

            return (
              <HistoryCard
                key={r.event_id}
                row={r}
                isDeleting={isDeleting}
                canDelete={canDelete}
                disableDelete={deleting !== null}
                onDelete={() => requestDelete(r)}
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

      <ManualAddHistoryEventModal
        open={manualAddOpen}
        groupId={groupId}
        userId={userId}
        onClose={() => setManualAddOpen(false)}
        onSaved={() => loadHistory(groupId)}
      />

      {deleteConfirmation ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-delete-title"
          aria-describedby="history-delete-description"
          onClick={cancelDelete}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 180,
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
              width: "min(360px, 100%)",
              borderRadius: 12,
              background: "#fafafa",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)",
              padding: 24,
            }}
          >
            <div
              id="history-delete-title"
              style={{
                fontSize: 20,
                lineHeight: "28px",
                fontWeight: 600,
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              Delete dining event?
            </div>
            <p
              id="history-delete-description"
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: "20px",
                color: "#4a5565",
                textAlign: "center",
              }}
            >
              This action cannot be undone.
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button
                type="button"
                onClick={cancelDelete}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fafafa",
                  color: "#0a0a0a",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: "#dc2626",
                  color: "white",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
