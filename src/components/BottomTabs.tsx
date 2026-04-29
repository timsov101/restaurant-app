"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Utensils, Search, History, Users } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/eat", label: "Eat", Icon: Utensils },
  { href: "/restaurants", label: "Restaurants", Icon: Search },
  { href: "/history", label: "History", Icon: History },
  { href: "/diners", label: "Diners", Icon: Users },
];

// Treat /events/* as part of Eat until we merge into /eat
function isActive(pathname: string, href: string) {
  if (href === "/eat") return pathname === "/eat" || pathname.startsWith("/events");

  // Keep the legacy /groups route highlighted while it redirects to /diners.
  if (href === "/diners") return pathname === "/diners" || pathname.startsWith("/groups");

  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "white",
        borderTop: "1px solid #e5e7eb", // gray-200
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 50,
      }}
      aria-label="Bottom navigation"
    >
      <div
        style={{
          height: 64, // h-16
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {navItems.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                transition: "color 150ms ease",
                color: active ? "#2563eb" : "#6b7280", // blue-600 / gray-500
              }}
            >
              <Icon size={24} />
              <span style={{ fontSize: 12, marginTop: 4 }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
