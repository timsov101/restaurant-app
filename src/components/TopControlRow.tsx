"use client";

import type { ReactNode } from "react";
import { Filter } from "lucide-react";

type TopControlRowProps = {
  filterActive: boolean;
  filterAccentColor?: string;
  marginBottom?: number;
  onFilterClick: () => void;
  trigger: ReactNode;
};

export default function TopControlRow({
  filterActive,
  filterAccentColor = "#1d4ed8",
  marginBottom = 12,
  onFilterClick,
  trigger,
}: TopControlRowProps) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: 40,
        marginBottom,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "min(calc(100% - 52px), 208px)" }}>{trigger}</div>
      </div>

      <button
        type="button"
        title="Filters"
        aria-label="Filters"
        aria-pressed={filterActive}
        onClick={onFilterClick}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 40,
          height: 40,
          borderRadius: 999,
          border: `2px solid ${filterAccentColor}`,
          background: filterActive ? "#1d4ed8" : "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: filterActive ? "white" : filterAccentColor,
          cursor: "pointer",
        }}
      >
        <Filter size={16} />
      </button>
    </div>
  );
}
