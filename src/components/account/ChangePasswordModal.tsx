"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

type ChangePasswordModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

function inputStyle(): CSSProperties {
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
  };
}

function passwordStrengthLabel(value: string) {
  const lengthScore = value.length >= 12 ? 2 : value.length >= 8 ? 1 : 0;
  const varietyScore =
    Number(/[a-z]/.test(value)) +
    Number(/[A-Z]/.test(value)) +
    Number(/\d/.test(value)) +
    Number(/[^a-zA-Z0-9]/.test(value));
  const score = lengthScore + varietyScore;

  if (value.length === 0) {
    return { label: "", color: "#16a34a" };
  }

  if (score >= 5) return { label: "Very strong", color: "#16a34a" };
  if (score >= 4) return { label: "Strong", color: "#15803d" };
  if (score >= 3) return { label: "Medium", color: "#ca8a04" };
  return { label: "Weak", color: "#dc2626" };
}

export default function ChangePasswordModal({
  open,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrengthLabel(password), [password]);

  useEffect(() => {
    if (!open) return;

    const resetTimer = window.setTimeout(() => {
      setPassword("");
      setSaving(false);
      setError(null);
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(resetTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit() {
    if (password.length < 8) {
      setError("Please enter a password with at least 8 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSuccess?.("Password updated.");
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Change password"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 170,
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
          <div
            style={{
              fontSize: 18,
              lineHeight: "28px",
              fontWeight: 700,
              letterSpacing: "-0.44px",
              color: "#0a0a0a",
              textAlign: "center",
            }}
          >
            Change Password
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close change password dialog"
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
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              lineHeight: "20px",
              color: "#717182",
              textAlign: "center",
            }}
          >
            Enter your new password below.
          </p>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <label
            htmlFor="change-password-input"
            style={{
              display: "block",
              fontSize: 14,
              lineHeight: "14px",
              fontWeight: 500,
              color: "#0a0a0a",
            }}
          >
            New password
          </label>
          <input
            id="change-password-input"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            style={{ ...inputStyle(), marginTop: 8 }}
          />
          {strength.label ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                lineHeight: "16px",
                color: strength.color,
              }}
            >
              {strength.label}
            </div>
          ) : null}
          {error ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                lineHeight: "16px",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          ) : null}
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
            onClick={() => void handleSubmit()}
            disabled={saving}
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
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
