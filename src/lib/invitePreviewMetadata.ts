import { supabase } from "@/lib/supabaseClient";

export const invitePreviewDescription =
  "Plan meals together, save restaurants, and pick where to eat next.";

export function invitePreviewTitle(groupName: string | null) {
  const trimmedName = groupName?.trim();
  if (!trimmedName) return "Join my group on Whistle";
  return `Join my ${trimmedName} group on Whistle`;
}

export function getInvitePreviewOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!configuredOrigin) return "http://localhost:3000";
  if (/^https?:\/\//.test(configuredOrigin)) return configuredOrigin;
  return `https://${configuredOrigin}`;
}

export async function loadInvitePreviewGroupName(token: string) {
  if (!token) return null;

  try {
    const { data, error } = await supabase
      .rpc("group_by_invite", { p_token: token })
      .maybeSingle();

    if (error || !data) return null;

    const group = data as {
      name?: string | null;
      group_name?: string | null;
    };

    return group.name ?? group.group_name ?? null;
  } catch {
    return null;
  }
}
