import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import NavAuth from "@/components/NavAuth";

export const metadata: Metadata = {
  title: "Restaurant App",
  description: "Group restaurant recommendations",
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        border: "1px solid transparent",
      }}
    >
      {label}
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white",
            borderBottom: "1px solid #eee",
          }}
        >
          <nav
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
              href="/groups"
              style={{
                fontWeight: 800,
                textDecoration: "none",
                color: "inherit",
                letterSpacing: 0.2,
              }}
            >
              🍽️ Restaurant App
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <NavLink href="/groups" label="Groups" />
                <NavLink href="/restaurants" label="Restaurants" />
                <NavLink href="/ratings" label="Ratings" />
                <NavLink href="/events/new" label="New Event" />
                <NavLink href="/profile" label="Profile" />
              </div>

              <NavAuth />
            </div>
          </nav>
        </header>

        <div style={{ maxWidth: 1000, margin: "0 auto" }}>{children}</div>
      </body>
    </html>
  );
}
