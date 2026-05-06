"use client";

import { Check, Copy, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

type FeedbackState =
  | { tone: "success" | "error"; message: string }
  | null;

type GroupInviteModalProps = {
  groupName: string;
  inviteUrl: string;
  onClose: () => void;
};

async function copyInviteUrl(inviteUrl: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Copy isn't available in this browser.");
  }

  await navigator.clipboard.writeText(inviteUrl);
}

export default function GroupInviteModal({
  groupName,
  inviteUrl,
  onClose,
}: GroupInviteModalProps) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleCopy() {
    setCopying(true);
    setFeedback(null);

    try {
      await copyInviteUrl(inviteUrl);
      setFeedback({ tone: "success", message: "Invite link copied." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn't copy the invite link.";
      setFeedback({ tone: "error", message });
    } finally {
      setCopying(false);
    }
  }

  async function handleShare() {
    if (!canShare) {
      await handleCopy();
      return;
    }

    setSharing(true);
    setFeedback(null);

    try {
      await navigator.share({
        url: inviteUrl,
      });
      setFeedback({ tone: "success", message: "Invite link shared." });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setSharing(false);
        return;
      }

      try {
        await copyInviteUrl(inviteUrl);
        setFeedback({
          tone: "success",
          message: "Share wasn't available, so the invite link was copied instead.",
        });
      } catch (copyError) {
        const message =
          copyError instanceof Error
            ? copyError.message
            : "Couldn't share or copy the invite link.";
        setFeedback({ tone: "error", message });
      } finally {
        setSharing(false);
      }

      return;
    }

    setSharing(false);
  }

  const shareLabel = canShare ? "Share invite" : "Copy invite";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Invite to ${groupName}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(384px, 100%)",
          background: "#fafafa",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "24px 24px 0", position: "relative" }}>
          <div
            style={{
              fontSize: 18,
              lineHeight: "18px",
              fontWeight: 600,
              letterSpacing: "-0.44px",
              color: "#0a0a0a",
              textAlign: "center",
            }}
          >
            Invite to {groupName}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close invite to ${groupName}`}
            style={{
              position: "absolute",
              top: 8,
              right: 0,
              width: 44,
              height: 44,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#4b5563",
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: "16px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #bedbff",
              background: "#eff6ff",
              padding: "16px 17px",
              color: "#1c398e",
              fontSize: 14,
              lineHeight: "20px",
              letterSpacing: "-0.15px",
            }}
          >
            Anyone with this link can join the group while it is active. The link
            stays active until it is revoked.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: "16px",
                  fontWeight: 500,
                  color: "#4a5565",
                }}
              >
                Invite Link
              </div>

              <div style={{ position: "relative", marginTop: 4 }}>
                <input
                  readOnly
                  value={inviteUrl}
                  aria-label="Invite link"
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid transparent",
                    background: "#f3f3f5",
                    padding: "0 44px 0 12px",
                    fontSize: 14,
                    lineHeight: "20px",
                    letterSpacing: "-0.15px",
                    color: "#0a0a0a",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  aria-label="Copy invite link"
                  disabled={copying || sharing}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#6a7282",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: copying || sharing ? "default" : "pointer",
                  }}
                >
                  {feedback?.tone === "success" && feedback.message === "Invite link copied." ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={copying || sharing}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 10,
                border: "none",
                background: "#1d4ed8",
                color: "white",
                fontSize: 14,
                lineHeight: "20px",
                fontWeight: 500,
                letterSpacing: "-0.15px",
                cursor: copying || sharing ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Share2 size={16} />
              <span>{sharing ? "Sharing..." : shareLabel}</span>
            </button>
          </div>

          {feedback ? (
            <div
              role="status"
              style={{
                fontSize: 12,
                lineHeight: "16px",
                color: feedback.tone === "success" ? "#1d4ed8" : "#b91c1c",
              }}
            >
              {feedback.message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
