"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { pickActiveGroupId, setStoredActiveGroupId } from "@/lib/activeGroup";
import FiltersDrawer, { EatFilters } from "@/components/FiltersDrawer";
import { Star, Leaf, DollarSign, MapPin } from "lucide-react";
import {
  Utensils,
  ChevronDown,
  SlidersHorizontal,
  X,
  Search as SearchIcon,
} from "lucide-react";

type Group = { id: string; name: string };
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
};

type SavedRestaurant = {
  id: string;
  name: string;
  address: string | null;
  primary_type: string | null;
  price_level: number | null;
};

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
        padding: "10px 14px",
        borderRadius: 999,
        border: selected ? "1px solid #1d4ed8" : "1px solid #e5e7eb",
        background: selected ? "#1d4ed8" : "white",
        color: selected ? "white" : "#111827",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxShadow: selected ? "0 4px 12px rgba(29,78,216,0.25)" : "none",
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
  const n = Math.max(1, Math.min(5, priceLevel + 1));
  return "$".repeat(n);
}

export default function EatPage() {
  const [uid, setUid] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>(
    {}
  );

  const [eventId, setEventId] = useState<string | null>(null);
  const [chosenRestaurantId, setChosenRestaurantId] = useState<string | null>(null);

  const [chosenDetails, setChosenDetails] = useState<SavedRestaurant | null>(null);
  const [chosenLastVisitText, setChosenLastVisitText] = useState<string | null>(null);

  const [recs, setRecs] = useState<RecRow[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickedViaModal, setPickedViaModal] = useState(false);

  // Pick My Own modal state
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [savedRestaurants, setSavedRestaurants] = useState<SavedRestaurant[]>([]);

  // debounce & init guards
  const debounceTimer = useRef<number | null>(null);
  const suppressAutoRun = useRef(false);

  // filter initial states
  const defaultFilters: EatFilters = {
    cuisines: [],
    maxPriceLevel: null,
    minOverall: null,
    minNutrition: null,
    maxDistanceMiles: null,
  };

  const [recMeta, setRecMeta] = useState<Record<string, { primary_type: string | null; price_level: number | null }>>({});

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<EatFilters>(defaultFilters);

  useEffect(() => {
    setVisibleCount(5);
  }, [filters]);

  const filteredRecs = useMemo(() => {
    return recs.filter((r) => {
      const meta = recMeta[r.restaurant_id] ?? { primary_type: null, price_level: null };

      if (filters.cuisines.length > 0) {
        if (!meta.primary_type || !filters.cuisines.includes(meta.primary_type)) return false;
      }

      if (filters.maxPriceLevel != null) {
        // include unknown prices; only exclude when known and too expensive
        if (meta.price_level != null && meta.price_level > filters.maxPriceLevel) return false;
      }

      if (filters.minOverall != null && Number(r.overall_avg) < filters.minOverall) return false;
      if (filters.minNutrition != null && Number(r.nutrition_avg) < filters.minNutrition) return false;

      return true;
    });
  }, [recs, recMeta, filters]);

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
    return savedRestaurants.filter((r) =>
      (r.name ?? "").toLowerCase().includes(q)
    );
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

  function selectedParticipantIds() {
    return Object.entries(selectedMembers)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  async function loadChosenDetails(rid: string) {
    const { data: r, error: rErr } = await supabase
      .from("restaurants")
      .select("id, name, address, primary_type, price_level")
      .eq("id", rid)
      .single();

    if (!rErr && r) setChosenDetails(r as SavedRestaurant);

    const participantIds = selectedParticipantIds();
    if (participantIds.length === 0) {
      setChosenLastVisitText(null);
      return;
    }

    const { data: visits } = await supabase
      .from("restaurant_visits")
      .select("last_visited_at")
      .eq("restaurant_id", rid)
      .in("user_id", participantIds)
      .order("last_visited_at", { ascending: false })
      .limit(1);

    const last = (visits?.[0] as any)?.last_visited_at ?? null;

    if (!last) {
      setChosenLastVisitText("Never");
      return;
    }

    const daysAgo = Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo <= 0) setChosenLastVisitText("Today");
    else if (daysAgo === 1) setChosenLastVisitText("Yesterday");
    else if (daysAgo < 7) setChosenLastVisitText(`${daysAgo} days ago`);
    else if (daysAgo < 30) setChosenLastVisitText(`${Math.round(daysAgo / 7)} weeks ago`);
    else setChosenLastVisitText(`${Math.round(daysAgo / 30)} months ago`);
  }

  useEffect(() => {
    if (chosenRestaurantId) {
      loadChosenDetails(chosenRestaurantId);
    } else {
      setChosenDetails(null);
      setChosenLastVisitText(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenRestaurantId]);

  async function loadRecs(eid: string) {
    const { data, error } = await supabase.rpc("recommendations_for_event", { p_event_id: eid });
    if (error) {
      setError(error.message);
      return;
    }
    setRecs((data ?? []) as RecRow[]);
    const ids = ((data ?? []) as RecRow[]).map((x) => x.restaurant_id);
    if (ids.length) {
      const { data: m } = await supabase
        .from("restaurants")
        .select("id, primary_type, price_level")
        .in("id", ids);

      const map: Record<string, { primary_type: string | null; price_level: number | null }> = {};
      (m ?? []).forEach((row: any) => {
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

    return (data ?? []).map((r: any) => r.user_id as string);
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

  async function ensureEventAndRecs(gid: string, desiredParticipants: string[]) {
    if (!uid) return;
    if (desiredParticipants.length === 0) {
      setRecs([]);
      setEventId(null);
      setChosenRestaurantId(null);
      return;
    }

    setLoadingRecs(true);
    setError(null);

    try {
      // 1) try reuse
      const draft = await findRecentDraftEvent(gid);

      if (draft?.id) {
        setEventId(draft.id);
        setChosenRestaurantId(draft.chosen_restaurant_id ?? null);

        // restore participants from DB (so chips persist when you come back)
        const existing = await loadParticipantsForEvent(draft.id);

        if (existing && existing.length > 0) {
          suppressAutoRun.current = true; // avoid loop while we set selection
          const nextSel: Record<string, boolean> = {};
          members.forEach((m) => {
            nextSel[m.user_id] = existing.includes(m.user_id);
          });
          setSelectedMembers(nextSel);
          suppressAutoRun.current = false;
          // Now update recommendations for that state
          await supabase.rpc("set_event_participants", {
            p_event_id: draft.id,
            p_user_ids: existing,
          });
        } else {
          // if no participants stored, use desired
          await supabase.rpc("set_event_participants", {
            p_event_id: draft.id,
            p_user_ids: desiredParticipants,
          });
        }

        await loadRecs(draft.id);
      } else {
        // 2) create new draft
        const ev = await createDraftEvent(gid, desiredParticipants);
        setEventId(ev.id);
        setChosenRestaurantId(ev.chosen_restaurant_id ?? null);
        await loadRecs(ev.id);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoadingRecs(false);
    }
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
    setError(null);
    setPickQuery("");
    setPickOpen(true);
    setPickLoading(true);

    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, address, primary_type, price_level")
      .order("created_at", { ascending: false })
      .limit(200);

    setPickLoading(false);
    if (error) return setError(error.message);

    setSavedRestaurants((data ?? []) as SavedRestaurant[]);
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

      const { data: gm, error } = await supabase
        .from("group_members")
        .select("groups ( id, name )")
        .eq("user_id", u);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const gs: Group[] = (gm ?? []).map((x: any) => x.groups).filter(Boolean);
      setGroups(gs);
      setLoading(false);

      const activeGroupId = pickActiveGroupId(gs);
      if (activeGroupId) setGroupId(activeGroupId);
    })();
  }, []);

  // When groupId changes: load members, restore draft participants, load recs
  useEffect(() => {
    if (!uid) return;
    if (!groupId) return;

    setStoredActiveGroupId(groupId);

    (async () => {
      setError(null);
      setLoadingMembers(true);
      setMembers([]);
      setRecs([]);
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
      } catch (e: any) {
        setError(e.message ?? String(e));
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
      {/* Group selector + filter icon (filter UI coming next) */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 14px",
              borderRadius: 999,
              border: "2px solid #1d4ed8",
              background: "white",
              fontSize: 16,
              fontWeight: 800,
              color: "#111827",
              boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            }}
          >
            <option value="">Select a group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          title="Filters"
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            border: "2px solid #1d4ed8",
            background: filtersActive ? "#1d4ed8" : "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            cursor: "pointer",
          }}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal color={filtersActive ? "white" : "#1d4ed8"} />
        </button>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

      {/* Diners chips */}
      {loadingMembers ? (
        <div style={{ opacity: 0.7, marginBottom: 12 }}>Loading diners…</div>
      ) : members.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
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
            borderRadius: 18,
            padding: 16,
            background: "white",
            border: "2px solid #1d4ed8",
            boxShadow: "0 10px 24px rgba(17,24,39,0.06)",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{chosenDetails.name}</div>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "#dcfce7",
                    color: "#166534",
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  Your Pick
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 16, color: "#6b7280", fontWeight: 700 }}>
                {prettyCuisine(chosenDetails.primary_type) ?? "Cuisine"}
              </div>

              {chosenDetails.address && (
                <div style={{ marginTop: 6, fontSize: 14, color: "#9ca3af", fontWeight: 700 }}>
                  {chosenDetails.address}
                </div>
              )}

              <div style={{ marginTop: 10, display: "flex", gap: 18, flexWrap: "wrap", fontWeight: 800 }}>
                <div style={{ color: "#2563eb" }}>$ {priceDollar(chosenDetails.price_level) ?? "—"}</div>
                <div style={{ color: "#7c3aed" }}>◎ — mi</div>
              </div>

              <div style={{ marginTop: 10, color: "#6b7280", fontWeight: 800 }}>
                › Last visit: {chosenLastVisitText ?? "—"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => chooseRestaurant(chosenDetails.id)}
              disabled={choosingId !== null}
              style={{
                height: 56,
                padding: "0 18px",
                borderRadius: 999,
                border: "2px solid #1d4ed8",
                background: "#1d4ed8",
                color: "white",
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 8px 18px rgba(29,78,216,0.16)",
                cursor: choosingId ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
              title="Log that we ate here today"
            >
              <Utensils size={18} />
              {choosingId === chosenDetails.id ? "Saving…" : "Eat Here"}
            </button>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visible.map((r, idx) => (
              <div
                key={r.restaurant_id}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: "white",
                  boxShadow: "0 10px 24px rgba(17,24,39,0.06)",
                  border: "1px solid #eef2ff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>
                        <span style={{ opacity: 0.35, marginRight: 8 }}>#{idx + 1}</span>
                        {r.name}
                      </div>

                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "#dbeafe",
                          color: "#1d4ed8",
                          fontWeight: 900,
                        }}
                      >
                        {Math.round(Number(r.final_score))}
                      </div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 16, color: "#6b7280", fontWeight: 550 }}>
                      {prettyCuisine(recMeta[r.restaurant_id]?.primary_type ?? null) ?? ""}
                    </div>

                    {r.address && (
                      <div style={{ marginTop: 6, fontSize: 14, color: "#9ca3af", fontWeight: 500 }}>
                        {r.address}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPickedViaModal(false);
                      chooseRestaurant(r.restaurant_id);
                    }}
                    disabled={choosingId !== null}
                    style={{
                      height: 56,
                      padding: "0 16px",
                      borderRadius: 999,
                      border: "2px solid #1d4ed8",
                      background: chosenRestaurantId === r.restaurant_id ? "#1d4ed8" : "white",
                      color: chosenRestaurantId === r.restaurant_id ? "white" : "#1d4ed8",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: "0 8px 18px rgba(29,78,216,0.16)",
                      cursor: choosingId ? "default" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="Log that we ate here today"
                  >
                    <Utensils size={18} />
                    {choosingId === r.restaurant_id ? "Saving…" : "Eat Here"}
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    fontWeight: 500,
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center" }}>
                      <Star size={16} fill="#f59e0b" />
                    </span>
                    <span style={{ color: "#111827" }}>{Number(r.overall_avg).toFixed(1)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#10b981", display: "inline-flex", alignItems: "center" }}>
                      <Leaf size={16} fill="#10b981" />
                    </span>
                    <span style={{ color: "#111827" }}>{Number(r.nutrition_avg).toFixed(1)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#2563eb", display: "inline-flex", alignItems: "center" }}>
                      <DollarSign size={16} />
                    </span>
                    <span style={{ color: "#111827" }}>{priceDollar(r.price_level) ?? "—"}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#7c3aed", display: "inline-flex", alignItems: "center" }}>
                      <MapPin size={16} />
                    </span>
                    <span style={{ color: "#111827" }}>— mi</span>
                  </div>
                </div>
              </div>
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

      {/* Pick My Own modal */}
      {pickOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setPickOpen(false)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight: "80vh",
              background: "white",
              borderRadius: 18,
              padding: 14,
              boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPickOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 36,
                height: 36,
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

            <div style={{ marginBottom: 12, paddingRight: 44 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "2px solid #c7d2fe",
                  borderRadius: 14,
                  padding: "10px 12px",
                }}
              >
                <SearchIcon color="#6b7280" />
                <input
                  value={pickQuery}
                  onChange={(e) => setPickQuery(e.target.value)}
                  placeholder="Search restaurants…"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                />
              </div>
            </div>

            <div style={{ overflowY: "auto", maxHeight: "calc(80vh - 92px)", paddingRight: 4 }}>
              {pickLoading ? (
                <div style={{ padding: 12, opacity: 0.7 }}>Loading…</div>
              ) : filteredSaved.length === 0 ? (
                <div style={{ padding: 12, opacity: 0.7 }}>No matches.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredSaved.map((r) => {
                    const cuisine = prettyCuisine(r.primary_type) ?? "Cuisine";
                    const dollars = priceDollar(r.price_level) ?? "—";
                    const isChosen = chosenRestaurantId === r.id;

                    return (
                      <div
                        key={r.id}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #e5e7eb",
                          padding: 14,
                          background: "white",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>{r.name}</div>
                            <div style={{ marginTop: 4, fontSize: 14, color: "#6b7280", fontWeight: 700 }}>
                              {cuisine}
                            </div>

                            <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap", fontWeight: 800 }}>
                              <div style={{ color: "#2563eb" }}>$ {dollars}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              setPickedViaModal(true);
                              await chooseRestaurant(r.id);
                              setPickOpen(false);
                            }}
                            disabled={choosingId !== null}
                            style={{
                              height: 56,
                              padding: "0 16px",
                              borderRadius: 999,
                              border: "2px solid #1d4ed8",
                              background: isChosen ? "#1d4ed8" : "white",
                              color: isChosen ? "white" : "#1d4ed8",
                              fontWeight: 900,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 10,
                              opacity: 1,
                              boxShadow: "0 8px 18px rgba(29,78,216,0.16)",
                              cursor: choosingId ? "default" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Utensils size={18} />
                            Eat Here
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        cuisineOptions={cuisineOptions}
        filters={filters}
        setFilters={setFilters}
        onReset={() => setFilters(defaultFilters)}
        matchCount={filteredRecs.length}
      />
    </main>
  );
}
