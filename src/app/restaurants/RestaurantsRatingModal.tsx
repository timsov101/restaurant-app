"use client";

import { useEffect } from "react";
import { DollarSign, Leaf, Star, X } from "lucide-react";

type RatingDraft = {
  overall: number | null;
  nutrition: number | null;
  costLevel: number | null;
};

type RestaurantsRatingModalProps = {
  open: boolean;
  restaurantName: string;
  draft: RatingDraft;
  saving: boolean;
  error: string | null;
  closeLabel?: string;
  primaryLabel?: string;
  secondaryLabel?: string | null;
  costNote?: string | null;
  onClose: () => void;
  onChange: (draft: RatingDraft) => void;
  onSave: () => void;
  onSecondaryAction?: () => void;
};

const costOptions = [
  { level: 1, label: "$", range: "$0-15" },
  { level: 2, label: "$$", range: "$16-25" },
  { level: 3, label: "$$$", range: "$26-40" },
  { level: 4, label: "$$$$", range: "$41+" },
];

function scoreText(value: number | null) {
  return `${value ?? 0}/5`;
}

function nutritionOptions() {
  return [
    { label: "Low", value: 1 },
    { label: "Good", value: 3 },
    { label: "Great", value: 5 },
  ];
}

export default function RestaurantsRatingModal({
  open,
  restaurantName,
  draft,
  saving,
  error,
  closeLabel = "Cancel",
  primaryLabel = "Save Rating",
  secondaryLabel = "Cancel",
  costNote = null,
  onClose,
  onChange,
  onSave,
  onSecondaryAction,
}: RestaurantsRatingModalProps) {
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
      aria-label={`Rate ${restaurantName}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(361px, 100%)",
          background: "#fafafa",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)",
          position: "relative",
          padding: "24px 24px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            minHeight: 28,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 20,
              lineHeight: "28px",
              fontWeight: 700,
              letterSpacing: "-0.45px",
              color: "#0a0a0a",
              textAlign: "center",
            }}
          >
            {restaurantName}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            style={{
              position: "absolute",
              right: -12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 44,
              height: 44,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#4a5565",
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#0a0a0a",
              }}
            >
              <Star size={16} color="#f59e0b" strokeWidth={1.8} />
              <span>Overall Satisfaction</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 6,
                marginTop: 12,
              }}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const active = (draft.overall ?? 0) >= value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        overall: value,
                      })
                    }
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    title={`Set overall satisfaction to ${value}`}
                  >
                    <Star
                      size={28}
                      color={active ? "#ff9f0a" : "#cbd5e1"}
                      fill={active ? "#ff9f0a" : "transparent"}
                      strokeWidth={1.8}
                    />
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: "20px",
                color: "#4a5565",
                textAlign: "center",
                letterSpacing: "-0.15px",
              }}
            >
              {scoreText(draft.overall)}
            </div>

            {costNote ? (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  lineHeight: "16px",
                  color: "#6a7282",
                  textAlign: "center",
                }}
              >
                {costNote}
              </div>
            ) : null}
          </section>

          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#0a0a0a",
              }}
            >
              <Leaf size={16} color="#16a34a" strokeWidth={1.8} />
              <span>Nutritional Value</span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
              }}
            >
              {nutritionOptions().map((option) => {
                const selected = draft.nutrition === option.value;

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        nutrition: option.value,
                      })
                    }
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 10,
                      border: selected
                        ? "1.892px solid #00a63e"
                        : "1.892px solid #d1d5dc",
                      background: selected ? "#00a63e" : "white",
                      color: selected ? "white" : "#4a5565",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Leaf
                      size={20}
                      color={selected ? "white" : "#16a34a"}
                      fill={selected ? "white" : "transparent"}
                      strokeWidth={1.8}
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: "20px",
                color: "#4a5565",
                textAlign: "center",
                letterSpacing: "-0.15px",
              }}
            >
              {scoreText(draft.nutrition)}
            </div>
          </section>

          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#0a0a0a",
              }}
            >
              <DollarSign size={16} color="#2563eb" strokeWidth={1.8} />
              <span>Cost per person</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
                marginTop: 12,
              }}
            >
              {costOptions.map((option) => {
                const selected = draft.costLevel === option.level;

                return (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        costLevel: option.level,
                      })
                    }
                    style={{
                      minHeight: 54,
                      borderRadius: 10,
                      border: selected
                        ? "1.892px solid #1d4ed8"
                        : "1.892px solid #d1d5dc",
                      background: selected ? "#1d4ed8" : "white",
                      color: selected ? "white" : "#4a5565",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: "20px", fontWeight: 700 }}>
                      {option.label}
                    </span>
                    <span style={{ fontSize: 12, lineHeight: "16px", fontWeight: 500 }}>
                      {option.range}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {error ? (
            <div
              style={{
                fontSize: 13,
                lineHeight: "18px",
                color: "crimson",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 8,
              paddingTop: 16,
            }}
          >
            {secondaryLabel ? (
              <button
                type="button"
                onClick={onSecondaryAction ?? onClose}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fafafa",
                  color: "#0a0a0a",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {secondaryLabel}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 10,
                border: "none",
                background: "#1d4ed8",
                color: "white",
                fontSize: 14,
                fontWeight: 500,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
