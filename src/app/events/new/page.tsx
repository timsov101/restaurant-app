"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AvatarName from "@/components/AvatarName";

type Group = { id: string; name: string };
type Member = { user_id: string; role: string; display_name: string | null };

export default function NewEventPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id ?? null;
      if (!u) {
        window.location.href = "/auth?next=%2Fevents%2Fnew";
        return;
      }
      setUid(u);

      const { data: gm, error: e } = await supabase
        .from("group_members")
        .select("groups ( id, name )")
        .eq("user_id", u);

      if (e) return setError(e.message);

      const gs: Group[] = (gm ?? []).map((x: any) => x.groups).filter(Boolean);
      setGroups(gs);
    })();
  }, []);

  async function loadMembers(gid: string) {
    setError(null);
    setMembers([]);
    setSelected({});

    const { data, error } = await supabase.rpc("members_for_group", { p_group_id: gid });
    if (error) return setError(error.message);

    const ms = (data ?? []) as Member[];
    setMembers(ms);

    // Default to all selected
    const sel: Record<string, boolean> = {};
    ms.forEach((m) => (sel[m.user_id] = true));
    setSelected(sel);
  }

  async function createEvent() {
    if (!uid) return;
    if (!groupId) return setError("Pick a group.");

    const participantIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (participantIds.length === 0) return setError("Select at least one participant.");

    setCreating(true);
    setError(null);

    // Create event
    const { data: ev, error: e1 } = await supabase
      .from("dining_events")
      .insert({ group_id: groupId, created_by: uid })
      .select("id")
      .single();

    if (e1) {
      setCreating(false);
      return setError(e1.message);
    }

    // Insert participants (creator-only policy allows)
    const rows = participantIds.map((pid) => ({ event_id: ev.id, user_id: pid }));
    const { error: e2 } = await supabase.from("dining_event_participants").insert(rows);

    setCreating(false);

    if (e2) return setError(e2.message);

    window.location.href = `/events/${ev.id}`;
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>New Dining Event</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Group</div>
        <select
          value={groupId}
          onChange={(e) => {
            const gid = e.target.value;
            setGroupId(gid);
            if (gid) loadMembers(gid);
          }}
          style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
        >
          <option value="">Select a group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        {members.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Participants (defaults to all)
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {members.map((m) => (
                <label key={m.user_id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[m.user_id])}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [m.user_id]: e.target.checked }))
                    }
                  />
                  <AvatarName
                    name={m.display_name}
                    subtitle={m.role === "owner" ? "Owner" : null}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={createEvent}
          disabled={creating}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #999",
            cursor: creating ? "default" : "pointer",
          }}
        >
          {creating ? "Creating…" : "Create event & get recommendations"}
        </button>
      </section>
    </main>
  );
}
