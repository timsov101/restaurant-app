"use client";

export type ActiveGroupColorPair = {
  background: string;
  foreground: string;
};

const ACTIVE_GROUP_COLOR_PAIRS: ActiveGroupColorPair[] = [
  { background: "rgba(216,180,254,0.125)", foreground: "#6b21a8" },
  { background: "rgba(134,239,172,0.125)", foreground: "#166534" },
  { background: "rgba(253,164,175,0.125)", foreground: "#881337" },
  { background: "rgba(253,224,71,0.125)", foreground: "#854d0e" },
  { background: "rgba(165,243,252,0.125)", foreground: "#155e75" },
];

export function getActiveGroupColorPair(index: number | null | undefined) {
  const safeIndex =
    typeof index === "number" && Number.isFinite(index) && index >= 0
      ? Math.floor(index)
      : 0;

  return ACTIVE_GROUP_COLOR_PAIRS[safeIndex % ACTIVE_GROUP_COLOR_PAIRS.length];
}
