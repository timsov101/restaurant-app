"use client";

export type ActiveGroup = {
  id: string;
  name: string;
  location_label?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_place_id?: string | null;
};

const ACTIVE_GROUP_STORAGE_KEY = "activeGroupId";

export function getStoredActiveGroupId() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveGroupId(groupId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, groupId);
  } catch {
    // Ignore storage failures and keep the current in-memory selection working.
  }
}

export function pickActiveGroupId(groups: ActiveGroup[]) {
  const storedId = getStoredActiveGroupId();

  if (storedId && groups.some((group) => group.id === storedId)) {
    return storedId;
  }

  return groups[0]?.id ?? null;
}
