"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

const SPLASH_DELAY_MS = 650;

export default function LaunchPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function routeAfterSplash() {
      const startedAt = Date.now();
      const { data } = await supabase.auth.getSession();
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(SPLASH_DELAY_MS - elapsed, 0);
      const destination = data.session ? "/eat" : "/auth";

      timeoutId = setTimeout(() => {
        if (active) {
          router.replace(destination);
        }
      }, remaining);
    }

    void routeAfterSplash();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router]);

  return (
    <main
      aria-label="Launching Whistle"
      style={{
        minHeight: "100vh",
        background: "#062a61",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 68px",
        boxSizing: "border-box",
      }}
    >
      <Image
        src="/brand/logo/Whistle-Brand-Assets_lockup-vertical-dark.svg"
        alt="Whistle"
        width={256}
        height={256}
        priority
        style={{
          width: "min(256px, 100%)",
          height: "auto",
          display: "block",
        }}
      />
    </main>
  );
}
