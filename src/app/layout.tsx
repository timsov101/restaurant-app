import type { Metadata } from "next";
import "./globals.css";

import AppShell from "@/components/AppShell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
