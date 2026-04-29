"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import BottomTabs from "@/components/BottomTabs";
import NavAuth from "@/components/NavAuth";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname === "/auth" || pathname.startsWith("/invite/");

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "white",
          borderBottom: "1px solid #eee",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Link
            href="/eat"
            style={{
              fontWeight: 800,
              textDecoration: "none",
              color: "inherit",
              letterSpacing: 0.2,
            }}
          >
            🍽️ Eat
          </Link>

          <NavAuth />
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: "88px" }}>
        {children}
      </div>

      <BottomTabs />
    </>
  );
}
