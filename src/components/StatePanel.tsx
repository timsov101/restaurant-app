"use client";

import { Star } from "lucide-react";

function Spinner({ size = 22, color = "#6a7282" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke={color}
        strokeOpacity="0.2"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="3"
      >
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          dur="0.75s"
          from="0 12 12"
          repeatCount="indefinite"
          to="360 12 12"
          type="rotate"
        />
      </path>
    </svg>
  );
}

type StatePanelProps = {
  loading?: boolean;
  message: string;
};

export default function StatePanel({
  loading = false,
  message,
}: StatePanelProps) {
  return (
    <div
      role={loading ? "status" : undefined}
      aria-label={loading ? message : undefined}
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        {loading ? <Spinner /> : <Star size={32} color="#99a1af" />}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.4,
          color: "#6a7282",
          letterSpacing: "-0.15px",
        }}
      >
        {message}
      </div>
    </div>
  );
}
