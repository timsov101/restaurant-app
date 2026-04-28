"use client";

import { ChevronDown, Users } from "lucide-react";
import type { ActiveGroupOption } from "@/lib/activeGroupData";
import { getActiveGroupColorPair } from "@/lib/activeGroupColors";

type ActiveGroupTriggerProps = {
  activeGroup: ActiveGroupOption | null;
  disabled?: boolean;
  onClick: () => void;
};

export default function ActiveGroupTrigger({
  activeGroup,
  disabled = false,
  onClick,
}: ActiveGroupTriggerProps) {
  const colorPair = activeGroup
    ? getActiveGroupColorPair(activeGroup.colorIndex)
    : { background: "#f3f4f6", foreground: "#6a7282" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label="Select active group"
      style={{
        width: "100%",
        height: 40,
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.08)",
        background: colorPair.background,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: colorPair.foreground,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <Users size={16} color={colorPair.foreground} />
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: 600,
          lineHeight: "20px",
          letterSpacing: "-0.15px",
        }}
      >
        {activeGroup?.name ?? "No groups"}
      </span>
      <ChevronDown size={16} color={colorPair.foreground} />
    </button>
  );
}
