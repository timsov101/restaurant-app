"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id ?? null;
      const e = data.session?.user?.email ?? null;

      if (!u) {
        window.location.href = "/auth?next=%2Fprofile";
        return;
      }

      setUid(u);
      setEmail(e);

      const { data: p, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", u)
        .single();

      if (!error && p?.display_name) setDisplayName(p.display_name);

      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!uid) return;
    setSaving(true);
    setMsg(null);

    const name = displayName.trim();
    if (!name) {
      setSaving(false);
      setMsg("Please enter a display name.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", uid);

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Saved!");
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Profile</h1>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        Signed in as: {email}
      </div>

      <label style={{ fontSize: 13, fontWeight: 600 }}>Display name</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="e.g., Tim"
        style={{
          display: "block",
          width: "100%",
          marginTop: 6,
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #999",
          cursor: saving ? "default" : "pointer",
          background: "#fafafa",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {msg && <p style={{ marginTop: 10, color: msg === "Saved!" ? "green" : "crimson" }}>{msg}</p>}
    </main>
  );
}
