import React from "react";

function initialsFrom(name: string | null | undefined) {
  const s = (name ?? "").trim();
  if (!s) return "?";
  const parts = s.replace(/[^a-zA-Z0-9 ]/g, " ").split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AvatarName({
  name,
  subtitle,
}: {
  name: string | null | undefined;
  subtitle?: string | null;
}) {
  const initials = initialsFrom(name);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 800,
          background: "#fafafa",
          flex: "0 0 auto",
        }}
        aria-label={name ?? "Unknown user"}
        title={name ?? "Unknown user"}
      >
        {initials}
      </div>

      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {name?.trim() ? name : "Unknown"}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
