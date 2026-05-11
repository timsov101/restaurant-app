"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type OwnerInviteStatus = "loading" | "redeeming" | "success" | "error";

export default function OwnerInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();
  const [status, setStatus] = useState<OwnerInviteStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function redeemInvite() {
      if (!token || typeof token !== "string") {
        setStatus("error");
        setError("Invalid owner invite link.");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionError) {
        setStatus("error");
        setError(sessionError.message);
        return;
      }

      if (!sessionData.session) {
        window.location.href = `/auth?next=${encodeURIComponent(`/owner-invite/${token}`)}`;
        return;
      }

      setStatus("redeeming");
      setError(null);

      const { error: redeemError } = await supabase.rpc("redeem_owner_invite", {
        p_token: token,
      });

      if (!active) return;

      if (redeemError) {
        setStatus("error");
        setError(redeemError.message);
        return;
      }

      setStatus("success");
      router.replace("/diners");
    }

    void redeemInvite();

    return () => {
      active = false;
    };
  }, [router, token]);

  const title =
    status === "error"
      ? "Owner invite could not be redeemed"
      : status === "success"
        ? "Owner invite redeemed"
        : "Redeeming owner invite";

  const body =
    status === "error"
      ? error ?? "This owner invite could not be redeemed."
      : status === "success"
        ? "Opening Diners..."
        : "Checking your invite and account now.";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fcf5e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        color: "#213166",
      }}
    >
      <div
        style={{
          width: "min(360px, 100%)",
          borderRadius: 12,
          background: "white",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.08)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, lineHeight: "28px" }}>{title}</h1>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: "20px", color: "#4a5565" }}>
          {body}
        </p>

        {status === "error" ? (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href={`/auth?next=${encodeURIComponent(`/owner-invite/${token ?? ""}`)}`}
              style={{
                minHeight: 40,
                borderRadius: 10,
                background: "#1d4ed8",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Sign in and try again
            </Link>
            <Link
              href="/diners"
              style={{
                minHeight: 40,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.08)",
                color: "#213166",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Go to Diners
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
