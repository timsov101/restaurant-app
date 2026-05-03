"use client";

export const DISTANCE_FILTER_STOPS = [1, 2, 3, 5, 10, 15, 20] as const;
export const OPEN_ENDED_DISTANCE_STOP =
  DISTANCE_FILTER_STOPS[DISTANCE_FILTER_STOPS.length - 1];

export function getDistanceFilterIndex(value: number | null) {
  if (value == null) return DISTANCE_FILTER_STOPS.length - 1;

  const index = DISTANCE_FILTER_STOPS.indexOf(
    value as (typeof DISTANCE_FILTER_STOPS)[number]
  );

  return index >= 0 ? index : DISTANCE_FILTER_STOPS.length - 1;
}

export function getDistanceFilterValue(index: number) {
  const boundedIndex = Math.max(
    0,
    Math.min(DISTANCE_FILTER_STOPS.length - 1, Math.round(index))
  );

  return DISTANCE_FILTER_STOPS[boundedIndex];
}

export function formatDistanceFilterLabel(value: number | null) {
  const resolvedValue =
    value == null ? OPEN_ENDED_DISTANCE_STOP : Math.max(1, Math.round(value));

  return resolvedValue >= OPEN_ENDED_DISTANCE_STOP
    ? `${OPEN_ENDED_DISTANCE_STOP}+ mi`
    : `${resolvedValue} mi`;
}

export function hasDistanceUpperBound(value: number | null): value is number {
  return value != null && value < OPEN_ENDED_DISTANCE_STOP;
}
