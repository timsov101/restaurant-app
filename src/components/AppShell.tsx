"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import BottomTabs from "@/components/BottomTabs";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname === "/" || pathname === "/auth" || pathname.startsWith("/invite/");
  const useCorePageBackground =
    pathname === "/eat" ||
    pathname === "/restaurants" ||
    pathname === "/history" ||
    pathname === "/diners";

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        style={{
          background: useCorePageBackground ? "#fafafa" : "transparent",
          minHeight: "calc(100vh - 88px)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: "88px" }}>
          {children}
        </div>
      </div>

      <BottomTabs />
    </>
  );
}
