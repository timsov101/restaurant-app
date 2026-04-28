"use client";

import { supabase } from "@/lib/supabaseClient";
import type { ActiveGroup } from "./activeGroup";

export type ActiveGroupOption = ActiveGroup & {
  colorIndex: number;
  memberCount: number;
};

export async function loadUserActiveGroups(userId: string) {
  const { data: memberships, error: membershipsError } = await supabase
    .from("group_members")
    .select("group_id, groups ( id, name )")
    .eq("user_id", userId);

  if (membershipsError) {
    return { groups: [] as ActiveGroupOption[], error: membershipsError.message };
  }

  const groups = ((memberships ?? []) as Array<{
    group_id: string;
    groups: ActiveGroup | null;
  }>)
    .map((row) => row.groups)
    .filter(Boolean) as ActiveGroup[];

  const groupIds = groups.map((group) => group.id);
  if (groupIds.length === 0) {
    return { groups: [] as ActiveGroupOption[], error: null };
  }

  const { data: memberRows, error: memberRowsError } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds);

  if (memberRowsError) {
    return { groups: [] as ActiveGroupOption[], error: memberRowsError.message };
  }

  const memberCountByGroupId = new Map<string, number>();
  ((memberRows ?? []) as Array<{ group_id: string }>).forEach((row) => {
    memberCountByGroupId.set(
      row.group_id,
      (memberCountByGroupId.get(row.group_id) ?? 0) + 1
    );
  });

  const sortedGroups = [...groups].sort((a, b) => {
    const nameComparison = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });

    if (nameComparison !== 0) return nameComparison;
    return a.id.localeCompare(b.id);
  });

  const colorIndexByGroupId = new Map<string, number>();
  sortedGroups.forEach((group, index) => {
    colorIndexByGroupId.set(group.id, index);
  });

  return {
    groups: groups.map((group) => ({
      ...group,
      colorIndex: colorIndexByGroupId.get(group.id) ?? 0,
      memberCount: memberCountByGroupId.get(group.id) ?? 0,
    })),
    error: null,
  };
}
