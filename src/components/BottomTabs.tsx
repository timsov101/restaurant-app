"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: string };

const tabs: Tab[] = [
  { href: "/eat", label: "Eat", icon: "🍽️" },
  { href: "/restaurants", label: "Restaurants", icon: "📍" },
  { href: "/history", label: "History", icon: "🕘" },
  { href: "/diners", label: "Diners", icon: "👥" },
];

function isActive(pathname: string, href: string) {
  if (href === "/eat") return pathname === "/eat" || pathname.startsWith("/events");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        borderTop: "1px solid #eee",
        background: "white",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Bottom navigation"
    >
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 2,
          padding: "8px 10px",
        }}
      >
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                borderRadius: 12,
                padding: "10px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                opacity: active ? 1 : 0.55,
                border: active ? "1px solid #ddd" : "1px solid transparent",
                background: active ? "#fafafa" : "transparent",
                minHeight: 56,
              }}
            >
              <div style={{ fontSize: 18, lineHeight: "18px" }}>{t.icon}</div>
              <div style={{ fontSize: 12, fontWeight: active ? 700 : 600 }}>
                {t.label}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
