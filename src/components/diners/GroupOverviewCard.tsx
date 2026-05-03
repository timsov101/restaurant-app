"use client";

import type { CSSProperties } from "react";
import { Crown, Pencil, UserRoundPlus, Users } from "lucide-react";

export type GroupCardMember = {
  user_id: string;
  display_name: string | null;
};

type GroupOverviewCardProps = {
  groupName: string;
  memberCount: number;
  members: GroupCardMember[];
  ownerUserId: string;
  currentUserId: string | null;
  hasOpenInvite: boolean;
  onInvite?: () => void;
  onEdit?: () => void;
  onRevokeInvite?: () => void;
};

function memberChipStyle(isOwner: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: isOwner ? 6 : 0,
    minHeight: 24,
    padding: isOwner ? "4px 10px" : "4px 12px",
    borderRadius: 999,
    background: isOwner ? "#fef3c6" : "#f3f4f6",
    color: isOwner ? "#973c00" : "#364153",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 400,
    whiteSpace: "nowrap",
  };
}

export default function GroupOverviewCard({
  groupName,
  memberCount,
  members,
  ownerUserId,
  currentUserId,
  hasOpenInvite,
  onInvite,
  onEdit,
  onRevokeInvite,
}: GroupOverviewCardProps) {
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <Users size={16} color="#155dfc" />
            <div
              style={{
                fontSize: 16,
                lineHeight: "24px",
                fontWeight: 600,
                letterSpacing: "-0.31px",
                color: "#0a0a0a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {groupName}
            </div>
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
            }}
          >
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </div>
        </div>

        {onInvite || onEdit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {onInvite ? (
              <button
                type="button"
                onClick={onInvite}
                aria-label={`Invite members to ${groupName}`}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: "none",
                  background: "transparent",
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <UserRoundPlus size={18} />
              </button>
            ) : null}

            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${groupName}`}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: "none",
                  background: "transparent",
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Pencil size={18} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {members.map((member) => {
          const isOwner = member.user_id === ownerUserId;
          const isCurrentUser = member.user_id === currentUserId;
          const baseLabel = member.display_name?.trim() || "Unknown";
          const label = isCurrentUser ? `${baseLabel} (You)` : baseLabel;

          return (
            <div key={member.user_id} style={memberChipStyle(isOwner)}>
              {isOwner ? <Crown size={12} color="#d97706" /> : null}
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      {hasOpenInvite && onRevokeInvite ? (
        <button
          type="button"
          onClick={onRevokeInvite}
          style={{
            marginTop: 12,
            width: "100%",
            minHeight: 36,
            border: "none",
            borderRadius: 10,
            background: "#fef2f2",
            color: "#c10007",
            fontSize: 14,
            lineHeight: "20px",
            fontWeight: 500,
            letterSpacing: "-0.15px",
            cursor: "pointer",
          }}
        >
          Revoke open invite
        </button>
      ) : null}
    </article>
  );
}
