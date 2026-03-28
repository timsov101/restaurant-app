import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

import NavAuth from "@/components/NavAuth";
import BottomTabs from "@/components/BottomTabs";

export const metadata: Metadata = {
  title: "Restaurant App",
  description: "Group restaurant recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ background: "white" }}>
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
      </body>
    </html>
  );
}
