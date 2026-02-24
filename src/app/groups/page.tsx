"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Group = {
  id: string;
  name: string;
  owner_id: string;
  invite_token: string | null;
  created_at: string;
};

type Member = {
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
};

export default function GroupsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Record<string, Member[]>>(
    {}
  );

  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function inviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function loadGroups(uid: string) {
    setError(null);

    const { data, error } = await supabase
      .from("group_members")
      .select("groups ( id, name, owner_id, invite_token, created_at )")
      .eq("user_id", uid);

    if (error) {
      setError(error.message);
      setGroups([]);
      return [];
    }

    const mapped: Group[] = (data ?? [])
      .map((row: any) => row.groups)
      .filter(Boolean);

    mapped.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setGroups(mapped);
    return mapped;
  }

  async function loadMembersForGroups(gs: Group[]) {
    const result: Record<string, Member[]> = {};

    for (const g of gs) {
      const { data, error } = await supabase
        .rpc("members_for_group", { p_group_id: g.id });

      if (error) {
        setError(`Members load failed for ${g.name}: ${error.message}`);
        result[g.id] = [];
        continue;
      }

      const members = (data ?? []) as Member[];

      // Owner first, then alphabetical
      members.sort((a, b) => {
        if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
        const an = a.profiles?.display_name ?? "";
        const bn = b.profiles?.display_name ?? "";
        return an.localeCompare(bn);
      });

      result[g.id] = members;
    }

    setMembersByGroup(result);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const uid = data.session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        window.location.href = "/auth";
        return;
      }

      const gs = await loadGroups(uid);
      await loadMembersForGroups(gs);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function createGroup() {
    setError(null);

    const name = newGroupName.trim();
    if (!name) return setError("Please enter a group name.");
    if (!userId) return setError("Not signed in.");

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .insert({ name, owner_id: userId })
      .select("id, name, owner_id, invite_token, created_at")
      .single();

    if (gErr) return setError(gErr.message);

    const { error: mErr } = await supabase
      .from("group_members")
      .insert({ group_id: g.id, user_id: userId, role: "owner" });

    if (mErr) return setError(mErr.message);

    setNewGroupName("");

    const gs = await loadGroups(userId);
    await loadMembersForGroups(gs);
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Groups</h1>

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Create a group</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g., Family"
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />
          <button onClick={createGroup} style={{ padding: "10px 14px" }}>
            Create
          </button>
        </div>
        {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Your groups</h2>

        {groups.length === 0 ? (
          <p>No groups yet. Create one above.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => {
              const members = membersByGroup[g.id] ?? [];
              return (
                <div
                  key={g.id}
                  style={{
                    border: "1px solid #e3e3e3",
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <strong style={{ fontSize: 16 }}>{g.name}</strong>
                    {userId === g.owner_id && (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>(owner)</span>
                    )}
                  </div>

                  {g.invite_token ? (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      Invite link:&nbsp;
                      <a href={`/invite/${g.invite_token}`}>{inviteUrl(g.invite_token)}</a>
                      <button
                        type="button"
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          padding: "4px 8px",
                          border: "1px solid #999",
                          borderRadius: 6,
                          cursor: "pointer",
                          background: "#f5f5f5",
                        }}
                        onClick={async () => {
                          const text = inviteUrl(g.invite_token!);
                          try {
                            await navigator.clipboard.writeText(text);
                            alert("Invite link copied!");
                          } catch {
                            window.prompt("Copy this invite link:", text);
                          }
                        }}
                      >
                        Copy
                      </button>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                        Send this link by text or email. The recipient will sign in, then they’ll be added to the group.
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 13, color: "crimson" }}>
                      Missing invite token (unexpected)
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Members
                    </div>
                    {members.length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.75 }}>No members found.</div>
                    ) : (
                      <ul style={{ paddingLeft: 18, margin: 0 }}>
                        {members.map((m) => (
                          <li key={m.user_id} style={{ marginBottom: 4, fontSize: 13 }}>
                            {m.display_name ?? m.user_id}
                            {m.role === "owner" ? " (owner)" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <hr style={{ margin: "24px 0" }} />

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/auth";
        }}
      >
        Sign out
      </button>
    </main>
  );
}
