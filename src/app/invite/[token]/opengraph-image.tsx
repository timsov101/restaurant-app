import { ImageResponse } from "next/og";

import { getInvitePreviewOrigin } from "@/lib/invitePreviewMetadata";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function InviteOpenGraphImage() {
  const origin = getInvitePreviewOrigin();
  const logoUrl = `${origin}/brand/logo/Whistle-Brand-Assets_lockup-vertical-dark.svg`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#061829",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 56,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            transform: "translateY(-24px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={logoUrl}
            alt="Whistle"
            width={420}
            height={420}
            style={{
              display: "block",
            }}
          />
          <div
            style={{
              marginTop: 28,
              fontSize: 54,
              lineHeight: 1.2,
              fontWeight: 500,
              letterSpacing: 0,
              color: "#fcf5e8",
              textAlign: "center",
            }}
          >
            Let’s grab a meal together
          </div>
        </div>
      </div>
    ),
    size
  );
}
