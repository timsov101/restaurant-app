"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function InviteJoinPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  const [msg, setMsg] = useState("Checking invite link…");

  useEffect(() => {
    (async () => {
      // 1) Ensure signed in
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;

      if (!uid) {
        // send to auth, then come back here
        const next = encodeURIComponent(`/invite/${token}`);
        window.location.href = `/auth?next=${next}`;
        return;
      }

      if (!token || typeof token !== "string") {
        setMsg("Invalid invite token.");
        return;
      }

      // 2) Find group by token
      const { data: g, error: gErr } = await supabase
        .rpc("group_by_invite", { p_token: token })
        .single();

      if (gErr || !g) {
        setMsg("Invite link not found (or expired).");
        return;
      }

      setMsg(`Joining “${g.name}”…`);

      // 3) Try to insert membership; ignore duplicate key error
      const { error: joinErr } = await supabase
        .from("group_members")
        .insert({ group_id: g.id, user_id: uid, role: "member" });

      if (joinErr && !String(joinErr.message).toLowerCase().includes("duplicate")) {
        setMsg(`Could not join group: ${joinErr.message}`);
        return;
      }

      setMsg("Joined! Redirecting…");
      router.replace("/groups");
    })();
  }, [router, token]);

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Join Group</h1>
      <p>{msg}</p>
    </main>
  );
}
