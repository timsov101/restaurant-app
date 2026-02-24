"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function initialsFrom(nameOrEmail: string) {
  const s = nameOrEmail.trim();
  if (!s) return "?";
  // If it's an email, use the part before @
  const base = s.includes("@") ? s.split("@")[0] : s;
  const parts = base.replace(/[^a-zA-Z0-9 ]/g, " ").split(" ").filter(Boolean);

  if (parts.length === 0) return base.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function NavAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const label = useMemo(() => displayName || "Profile", [displayName]);
  const initials = useMemo(() => initialsFrom(label || "?"), [label]);

  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", uid)
      .single();

    setDisplayName(data?.display_name ?? null);
  }

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const session = data.session;
      const e = session?.user?.email ?? null;
      const uid = session?.user?.id ?? null;

      setEmail(e);
      setLoading(false);

      if (uid) loadProfile(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const e = session?.user?.email ?? null;
      const uid = session?.user?.id ?? null;

      setEmail(e);
      setDisplayName(null);

      if (uid) loadProfile(uid);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div style={{ fontSize: 12, opacity: 0.7 }}>…</div>;

  if (!email) {
    return (
      <Link
        href="/auth"
        style={{
          fontSize: 13,
          textDecoration: "none",
          border: "1px solid #ccc",
          padding: "8px 10px",
          borderRadius: 8,
          color: "inherit",
          background: "#fafafa",
        }}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Link
        href="/profile"
        title="Edit profile"
        style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: "1px solid #ccc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            background: "#fafafa",
          }}
        >
          {initials}
        </div>

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {displayName ? displayName : "Set name"}
        </div>
      </Link>

      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/auth";
        }}
        style={{
          fontSize: 13,
          border: "1px solid #ccc",
          padding: "8px 10px",
          borderRadius: 8,
          cursor: "pointer",
          background: "#fafafa",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
