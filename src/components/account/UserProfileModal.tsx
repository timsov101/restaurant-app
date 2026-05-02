"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { X } from "lucide-react";

import ChangePasswordModal from "@/components/account/ChangePasswordModal";
import { supabase } from "@/lib/supabaseClient";

type UserProfileModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
};

function inputStyle(readOnly = false): CSSProperties {
  return {
    width: "100%",
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0)",
    background: "#f3f3f5",
    padding: "0 12px",
    fontSize: 16,
    lineHeight: "20px",
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    cursor: readOnly ? "default" : "text",
  };
}

function sectionLabelStyle(): CSSProperties {
  return {
    display: "block",
    fontSize: 14,
    lineHeight: "14px",
    fontWeight: 500,
    color: "#0a0a0a",
  };
}

function passwordMask() {
  return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
}

export default function UserProfileModal({
  open,
  onClose,
  onSaved,
}: UserProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (!open || passwordModalOpen) return;

    let alive = true;

    const resetTimer = window.setTimeout(() => {
      if (!alive) return;
      setLoading(true);
      setSaving(false);
      setError(null);
      setFeedback(null);
      setPasswordModalOpen(false);
    }, 0);

    (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!alive) return;

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      const user = data.session?.user ?? null;
      const uid = user?.id ?? null;

      if (!uid) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }

      setUserId(uid);
      setEmail(user?.email?.trim() ?? "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", uid)
        .single();

      if (!alive) return;

      if (profileError && profileError.code !== "PGRST116") {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setDisplayName(profile?.display_name ?? "");
      setLoading(false);
    })();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      alive = false;
      window.clearTimeout(resetTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, passwordModalOpen]);

  if (!open) return null;

  async function handleSave() {
    if (!userId) {
      setError("Not signed in.");
      return;
    }

    const name = displayName.trim();
    if (!name) {
      setError("Please enter a preferred name.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSaved?.("Profile saved.");
    onClose();
  }

  async function handleSignOut() {
    setError(null);
    setFeedback(null);

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    window.location.href = "/auth";
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 160,
          background: "rgba(17,24,39,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(334px, 100%)",
            background: "#fafafa",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "20px 24px 0", position: "relative" }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile dialog"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#4b5563",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: "12px 24px 0" }}>
            <label htmlFor="profile-preferred-name" style={sectionLabelStyle()}>
              Display name
            </label>
            <input
              id="profile-preferred-name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError(null);
                setFeedback(null);
              }}
              placeholder="You"
              style={{ ...inputStyle(), marginTop: 8 }}
            />
          </div>

          <div style={{ padding: "16px 24px 0" }}>
            <label htmlFor="profile-email-address" style={sectionLabelStyle()}>
              Email address
            </label>
            <input
              id="profile-email-address"
              value={email}
              readOnly
              placeholder="No email address on file"
              style={{ ...inputStyle(true), marginTop: 8 }}
            />
          </div>

          <div style={{ padding: "16px 24px 0" }}>
            <label htmlFor="profile-password-mask" style={sectionLabelStyle()}>
              Password
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                id="profile-password-mask"
                value={passwordMask()}
                readOnly
                style={{ ...inputStyle(true), flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                style={{
                  width: 84,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fafafa",
                  color: "#0a0a0a",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Change
              </button>
            </div>
          </div>

          <div style={{ padding: "12px 24px 0" }}>
            {loading ? (
              <div style={{ fontSize: 12, lineHeight: "16px", color: "#6a7282" }}>
                Loading profile...
              </div>
            ) : null}
            {error ? (
              <div style={{ fontSize: 12, lineHeight: "16px", color: "#dc2626" }}>
                {error}
              </div>
            ) : null}
            {feedback ? (
              <div style={{ fontSize: 12, lineHeight: "16px", color: "#1d4ed8" }}>
                {feedback}
              </div>
            ) : null}
          </div>

          <div
            style={{
              padding: "12px 24px 0",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={loading || saving}
              style={{
                border: "none",
                background: "transparent",
                color: "#6a7282",
                fontSize: 13,
                lineHeight: "18px",
                fontWeight: 500,
                cursor: loading || saving ? "default" : "pointer",
                opacity: loading || saving ? 0.6 : 1,
                padding: 0,
              }}
            >
              Sign out
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "16px 24px 24px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "#fafafa",
                color: "#0a0a0a",
                fontSize: 14,
                lineHeight: "20px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 10,
                border: "none",
                background: "#1d4ed8",
                color: "white",
                fontSize: 14,
                lineHeight: "20px",
                fontWeight: 500,
                cursor: saving || loading ? "default" : "pointer",
                opacity: saving || loading ? 0.65 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </div>

      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={(message) => {
          setError(null);
          setFeedback(message);
        }}
      />
    </>
  );
}
