"use client";

export function createGroupInviteToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `group-invite-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export async function ensureGroupHasInviteToken({
  inviteToken,
  persistInviteToken,
}: {
  inviteToken: string | null;
  persistInviteToken: (nextToken: string) => Promise<string>;
}) {
  if (inviteToken) return inviteToken;

  const nextToken = createGroupInviteToken();
  return persistInviteToken(nextToken);
}

export function buildGroupInviteUrl(token: string) {
  if (typeof window === "undefined") return `/invite/${token}`;
  return new URL(`/invite/${token}`, window.location.origin).toString();
}
