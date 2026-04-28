"use client";

import { useEffect } from "react";
import { Check, Users } from "lucide-react";
import type { ActiveGroupOption } from "@/lib/activeGroupData";
import { getActiveGroupColorPair } from "@/lib/activeGroupColors";

type ActiveGroupModalProps = {
  activeGroupId: string;
  groups: ActiveGroupOption[];
  open: boolean;
  onClose: () => void;
  onSelect: (groupId: string) => void;
};

function memberCountLabel(count: number) {
  return `${count} member${count === 1 ? "" : "s"}`;
}

export default function ActiveGroupModal({
  activeGroupId,
  groups,
  open,
  onClose,
  onSelect,
}: ActiveGroupModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select group"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        background: "rgba(17,24,39,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(392px, 100%)",
          maxHeight: "min(766px, calc(100vh - 24px))",
          background: "#fafafa",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            padding: "24px 24px 16px",
            background: "white",
          }}
        >
          <div
            style={{
              fontSize: 18,
              lineHeight: "28px",
              fontWeight: 700,
              letterSpacing: "-0.44px",
              color: "#0a0a0a",
              textAlign: "center",
            }}
          >
            Select Group
          </div>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            padding: "0 24px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map((group) => {
              const colorPair = getActiveGroupColorPair(group.colorIndex);
              const isActive = group.id === activeGroupId;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onSelect(group.id)}
                  style={{
                    width: "100%",
                    minHeight: 68,
                    borderRadius: 12,
                    border: isActive ? "2px solid #d1d5db" : "2px solid #e5e7eb",
                    background: colorPair.background,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <Users size={16} color={colorPair.foreground} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          lineHeight: "24px",
                          fontWeight: 600,
                          letterSpacing: "-0.31px",
                          color: colorPair.foreground,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {group.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: "16px",
                          fontWeight: 500,
                          color: colorPair.foreground,
                          opacity: 0.88,
                        }}
                      >
                        {memberCountLabel(group.memberCount)}
                      </div>
                    </div>
                  </div>

                  {isActive ? (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: "#1d4ed8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <Check size={12} color="white" strokeWidth={2.5} />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
