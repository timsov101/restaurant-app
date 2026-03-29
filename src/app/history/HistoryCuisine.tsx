"use client";

type HistoryCuisineProps = {
  primaryType: string | null;
};

export function formatCuisineLabel(primaryType: string | null) {
  if (!primaryType) return null;

  return primaryType
    .replace(/_restaurant$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function HistoryCuisine({ primaryType }: HistoryCuisineProps) {
  const label = formatCuisineLabel(primaryType);

  if (!label) {
    return (
      <div
        style={{
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.35,
          color: "#6a7282",
          marginBottom: 4,
        }}
      >
        Cuisine unavailable
      </div>
    );
  }

  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.35,
        color: "#6a7282",
        marginBottom: 4,
      }}
    >
      {label}
    </div>
  );
}
