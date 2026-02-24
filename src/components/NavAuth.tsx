"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function NavAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
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
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Signed in as <span style={{ fontWeight: 600 }}>{email}</span>
      </div>

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
