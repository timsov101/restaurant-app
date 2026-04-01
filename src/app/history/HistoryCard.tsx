"use client";

import { CalendarDays, Trash2, Users } from "lucide-react";
import HistoryCuisine from "./HistoryCuisine";

export type HistoryRow = {
  event_id: string;
  chosen_at: string;
  group_id: string;
  group_name: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string | null;
  cuisine: string | null;
  diners: string | null;
};

type HistoryCardProps = {
  row: HistoryRow;
  isDeleting: boolean;
  disableDelete: boolean;
  onDelete: () => void;
};

function formatDateChip(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseDiners(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function pillStyle(background: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
    borderRadius: 10,
    padding: "6px 12px",
    background,
    color,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.2,
  };
}

function attendeeChipStyle(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "4px 10px",
    background: "#f3f4f6",
    color: "#364153",
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.3,
  };
}

function HistoryMetaPill({
  icon,
  label,
  background,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  background: string;
  color: string;
}) {
  return (
    <div style={pillStyle(background, color)}>
      <span style={{ display: "inline-flex", flex: "0 0 auto" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function HistoryAttendeeChip({ label }: { label: string }) {
  return <div style={attendeeChipStyle()}>{label}</div>;
}

export default function HistoryCard({
  row,
  isDeleting,
  disableDelete,
  onDelete,
}: HistoryCardProps) {
  const diners = parseDiners(row.diners);
  const address = row.restaurant_address ?? "Address unavailable";

  return (
    <article
      style={{
        borderRadius: 16,
        padding: 16,
        background: "#ffffff",
        boxShadow: "0 4px 24px rgba(17,24,39,0.08)",
        border: "1px solid #e5e7eb",
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.2,
              color: "#0a0a0a",
              marginBottom: 6,
            }}
          >
            {row.restaurant_name}
          </div>

          <HistoryCuisine primaryType={row.cuisine} />

          <div
            style={{
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1.35,
              color: "#99a1af",
              marginBottom: 4,
            }}
          >
            {address}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={disableDelete}
          title="Delete"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            background: "transparent",
            color: "#99a1af",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disableDelete ? "default" : "pointer",
            opacity: disableDelete && !isDeleting ? 0.45 : 1,
            flex: "0 0 auto",
          }}
          aria-label={`Delete ${row.restaurant_name}`}
        >
          <Trash2 size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 16,
          paddingBottom: 12,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <HistoryMetaPill
          icon={<CalendarDays size={16} />}
          label={formatDateChip(row.chosen_at)}
          background="#eff6ff"
          color="#1c398e"
        />
        <HistoryMetaPill
          icon={<Users size={16} />}
          label={row.group_name}
          background="#faf5ff"
          color="#59168b"
        />
      </div>

      <div
        style={{
          marginTop: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.35,
            color: "#6a7282",
            marginBottom: 8,
          }}
        >
          Diners:
        </div>

        {diners.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {diners.map((name) => (
              <HistoryAttendeeChip key={name} label={name} />
            ))}
          </div>
        ) : (
          <div style={{ ...attendeeChipStyle(), display: "inline-flex" }}>No attendees recorded</div>
        )}
      </div>

      {isDeleting ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: "#be123c",
          }}
        >
          Deleting...
        </div>
      ) : null}
    </article>
  );
}
