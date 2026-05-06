export const invitePreviewDescription =
  "Plan meals together, save restaurants, and pick where to eat next.";

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
