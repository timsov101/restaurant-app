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

export default function GroupsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadGroups(uid: string) {
    setError(null);

    const { data, error } = await supabase
      .from("group_members")
      .select("groups ( id, name, owner_id, invite_token, created_at )")
      .eq("user_id", uid);

    if (error) {
      setError(error.message);
      setGroups([]);
      return;
    }

    const mapped: Group[] = (data ?? [])
      .map((row: any) => row.groups)
      .filter(Boolean);

    mapped.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setGroups(mapped);
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

      await loadGroups(uid);
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

    // Create the group (invite_token default is generated in DB)
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .insert({ name, owner_id: userId })
      .select("id, name, owner_id, invite_token, created_at")
      .single();

    if (gErr) return setError(gErr.message);

    // Add yourself as owner member
    const { error: mErr } = await supabase
      .from("group_members")
      .insert({ group_id: g.id, user_id: userId, role: "owner" });

    if (mErr) return setError(mErr.message);

    setNewGroupName("");
    await loadGroups(userId);
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
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
          <ul style={{ paddingLeft: 18 }}>
            {groups.map((g) => (
              <li key={g.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <strong style={{ fontSize: 16 }}>{g.name}</strong>
                  {userId === g.owner_id && (
                    <span style={{ fontSize: 12, opacity: 0.7 }}>(owner)</span>
                  )}
                </div>

                {g.invite_token ? (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    Invite link:&nbsp;
                    <a href={`/invite/${g.invite_token}`}>{inviteUrl(g.invite_token)}</a>
                    &nbsp;
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
                          // Fallback if clipboard is blocked
                          window.prompt("Copy this invite link:", text);
                        }
                      }}
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 13, color: "crimson" }}>
                    Missing invite token (unexpected)
                  </div>
                )}
              </li>
            ))}
          </ul>
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
