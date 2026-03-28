"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
        padding: "8px 12px",
        borderRadius: 999,
        border: selected ? "1px solid #2563eb" : "1px solid #e5e7eb",
        background: selected ? "#eff6ff" : "white",
        color: selected ? "#1d4ed8" : "#111827",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
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

  const [recs, setRecs] = useState<RecRow[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => recs.slice(0, visibleCount), [recs, visibleCount]);

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
    })();
  }, []);

  async function loadMembersForGroup(gid: string) {
    setError(null);
    setLoadingMembers(true);
    setMembers([]);
    setSelectedMembers({});
    setEventId(null);
    setChosenRestaurantId(null);
    setRecs([]);
    setVisibleCount(5);

    const { data, error } = await supabase.rpc("members_for_group", { p_group_id: gid });
    setLoadingMembers(false);

    if (error) {
      setError(error.message);
      return;
    }

    const ms = (data ?? []) as Member[];
    setMembers(ms);

    const sel: Record<string, boolean> = {};
    ms.forEach((m) => (sel[m.user_id] = true));
    setSelectedMembers(sel);
  }

  async function createEventAndLoadRecs() {
    if (!uid) return;
    if (!groupId) return setError("Select a group.");

    const participantIds = Object.entries(selectedMembers)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (participantIds.length === 0) return setError("Select at least one diner.");

    setError(null);
    setLoadingRecs(true);

    // 1) Create event
    const { data: ev, error: e1 } = await supabase
      .from("dining_events")
      .insert({ group_id: groupId, created_by: uid })
      .select("id, chosen_restaurant_id")
      .single();

    if (e1) {
      setLoadingRecs(false);
      return setError(e1.message);
    }

    // 2) Insert participants
    const rows = participantIds.map((pid) => ({ event_id: ev.id, user_id: pid }));
    const { error: e2 } = await supabase.from("dining_event_participants").insert(rows);
    if (e2) {
      setLoadingRecs(false);
      return setError(e2.message);
    }

    setEventId(ev.id);
    setChosenRestaurantId(ev.chosen_restaurant_id ?? null);

    // 3) Load recommendations
    await loadRecs(ev.id);

    setLoadingRecs(false);
  }

  async function loadRecs(eid: string) {
    const { data, error } = await supabase.rpc("recommendations_for_event", { p_event_id: eid });
    if (error) return setError(error.message);
    setRecs((data ?? []) as RecRow[]);
    setVisibleCount(5);
  }

  async function chooseRestaurant(rid: string) {
    if (!eventId) return;
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

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Eat</div>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

      {/* Group selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
          Group
        </div>
        <select
          value={groupId}
          onChange={(e) => {
            const gid = e.target.value;
            setGroupId(gid);
            if (gid) loadMembersForGroup(gid);
          }}
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontSize: 14,
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

      {/* Diners chips */}
      {loadingMembers ? (
        <div style={{ opacity: 0.7, marginBottom: 12 }}>Loading diners…</div>
      ) : members.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#374151" }}>
            Diners
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
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
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Tap to include/exclude diners. Defaults to all selected.
          </div>
        </div>
      ) : null}

      {/* Get recommendations */}
      <button
        type="button"
        disabled={!groupId || loadingRecs}
        onClick={createEventAndLoadRecs}
        style={{
          width: "100%",
          padding: "14px 14px",
          borderRadius: 14,
          border: "1px solid #2563eb",
          background: "#2563eb",
          color: "white",
          fontWeight: 800,
          cursor: loadingRecs ? "default" : "pointer",
          opacity: !groupId ? 0.5 : 1,
          marginBottom: 14,
        }}
      >
        {loadingRecs ? "Getting recommendations…" : "Get recommendations"}
      </button>

      {/* Recommendations */}
      {recs.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            Top picks
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((r, idx) => {
              const isChosen = chosenRestaurantId === r.restaurant_id;

              return (
                <div
                  key={r.restaurant_id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    background: "white",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>
                        #{idx + 1} {r.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 800 }}>
                        {Number(r.final_score).toFixed(1)}
                      </div>
                    </div>
                    {r.address && (
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                        {r.address}
                      </div>
                    )}

                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>
                        Why this score?
                      </summary>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
                        Overall avg: {Number(r.overall_avg).toFixed(2)} (40%)<br />
                        Recency (variety): {Number(r.recency_score).toFixed(1)} (30%)<br />
                        Nutrition avg: {Number(r.nutrition_avg).toFixed(2)} (15%)<br />
                        Cost score: {Number(r.cost_score).toFixed(1)} (15%)
                      </div>
                    </details>
                  </div>

                  <button
                    type="button"
                    onClick={() => chooseRestaurant(r.restaurant_id)}
                    disabled={choosingId !== null}
                    style={{
                      width: 92,
                      height: 72,
                      borderRadius: 16,
                      border: "1px solid #e5e7eb",
                      background: isChosen ? "#2563eb" : "white",
                      color: isChosen ? "white" : "#111827",
                      cursor: choosingId ? "default" : "pointer",
                      opacity: isChosen ? 1 : 0.55,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 4,
                      flex: "0 0 auto",
                    }}
                    title="Log that we ate here today"
                  >
                    <div style={{ fontSize: 18 }}>🍴</div>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>
                      {choosingId === r.restaurant_id ? "Saving…" : "Eat Here"}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {visibleCount < recs.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.min(recs.length, c + 5))}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Show more
            </button>
          )}
        </>
      )}
    </main>
  );
}
