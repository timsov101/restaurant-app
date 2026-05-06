import type { Metadata } from "next";

import {
  getInvitePreviewOrigin,
  invitePreviewDescription,
} from "@/lib/invitePreviewMetadata";

type InviteLayoutProps = {
  children: React.ReactNode;
};

type InviteMetadataProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({
  params,
}: InviteMetadataProps): Promise<Metadata> {
  const { token } = await params;
  const origin = getInvitePreviewOrigin();
  const invitePath = `/invite/${encodeURIComponent(token)}`;
  const imagePath = `${invitePath}/opengraph-image`;
  const title = "Whistle";

  return {
    metadataBase: new URL(origin),
    title,
    description: invitePreviewDescription,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Whistle",
      statusBarStyle: "default",
    },
    openGraph: {
      title,
      description: invitePreviewDescription,
      siteName: "Whistle",
      type: "website",
      url: invitePath,
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: invitePreviewDescription,
      images: [imagePath],
    },
  };
}

export default function InviteLayout({ children }: InviteLayoutProps) {
  return children;
}
