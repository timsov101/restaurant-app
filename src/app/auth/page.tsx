"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type CSSProperties, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

function inviteShellStyle(): CSSProperties {
  return {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
    padding: "16px 16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function inviteCardStyle(): CSSProperties {
  return {
    width: "min(361px, 100%)",
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.1)",
    padding: 32,
    boxSizing: "border-box",
  };
}

function fieldLabelStyle(): CSSProperties {
  return {
    display: "block",
    fontSize: 14,
    lineHeight: "14px",
    fontWeight: 500,
    color: "#0a0a0a",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    height: 48,
    borderRadius: 10,
    border: "1px solid transparent",
    background: "#f3f3f5",
    padding: "0 12px",
    fontSize: 16,
    lineHeight: "20px",
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  };
}

function normalInputStyle(): CSSProperties {
  return {
    width: "100%",
    height: 48,
    borderRadius: 10,
    border: "1px solid #d1d5dc",
    background: "#ffffff",
    padding: "0 12px",
    fontSize: 16,
    lineHeight: "20px",
    color: "#213166",
    outline: "none",
    boxSizing: "border-box",
  };
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: 48,
    border: "none",
    borderRadius: 10,
    background: "#1d4ed8",
    color: "white",
    fontSize: 18,
    lineHeight: "28px",
    fontWeight: 500,
    letterSpacing: "-0.44px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}

function normalPrimaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: 48,
    border: "none",
    borderRadius: 10,
    background: "#fb7f19",
    color: "white",
    fontSize: 18,
    lineHeight: "28px",
    fontWeight: 500,
    letterSpacing: "-0.44px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.72 : 1,
  };
}

function normalAuthHref(mode: "signin" | "signup", nextUrl: string | null) {
  const params = new URLSearchParams();
  if (mode === "signup") params.set("mode", "signup");
  if (nextUrl) params.set("next", nextUrl);
  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function AuthPageContent() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const normalAuthMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const inviteMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const groupName = searchParams.get("groupName") ?? "your group";
  const inviteContext =
    searchParams.get("invite") === "1" && Boolean(nextUrl?.startsWith("/invite/"));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const has = Boolean(data.session);
      setIsSignedIn(has);
      setEmail(data.session?.user.email ?? null);

      if (has && nextUrl) {
        window.location.href = decodeURIComponent(nextUrl);
      } else if (has && !inviteContext) {
        window.location.href = "/eat";
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const has = Boolean(session);
      setIsSignedIn(has);
      setEmail(session?.user.email ?? null);

      if (has && nextUrl) {
        window.location.href = decodeURIComponent(nextUrl);
      } else if (has && !inviteContext) {
        window.location.href = "/eat";
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [inviteContext, nextUrl]);

  const nextInvitePath = nextUrl ? decodeURIComponent(nextUrl) : "/invite";
  const alternateMode = inviteMode === "signup" ? "signin" : "signup";
  const alternateLabel =
    inviteMode === "signup"
      ? "Already have an account? Sign in"
      : "Don't have an account? Create one";
  const authTitle = inviteMode === "signup" ? "Create account" : "Sign in";
  const authSubtitle =
    inviteMode === "signup"
      ? `Create an account to join ${groupName}`
      : `Sign in to join ${groupName}`;

  async function handleInviteSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(signupEmail);
    const displayName = signupDisplayName.trim();
    const password = signupPassword;

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!displayName) {
      setError("Please enter your display name.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setAuthenticating(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (signUpError) {
      setAuthenticating(false);
      setError(signUpError.message);
      return;
    }

    const userId = signUpData.user?.id ?? signUpData.session?.user?.id ?? null;
    if (!userId) {
      setAuthenticating(false);
      setError("Account created, but no user session was returned.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

    if (profileError) {
      await supabase.auth.signOut();
      setAuthenticating(false);
      setError(profileError.message);
      return;
    }

    window.location.href = nextInvitePath;
  }

  async function handleInviteSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(signinEmail);
    const password = signinPassword;

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setAuthenticating(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setAuthenticating(false);
      setError(signInError.message);
      return;
    }

    window.location.href = nextInvitePath;
  }

  async function handleNormalSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(signupEmail);
    const displayName = signupDisplayName.trim();
    const password = signupPassword;

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!displayName) {
      setError("Please enter your display name.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setAuthenticating(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (signUpError) {
      setAuthenticating(false);
      setError(signUpError.message);
      return;
    }

    const userId = signUpData.user?.id ?? signUpData.session?.user?.id ?? null;
    if (!userId) {
      setAuthenticating(false);
      setError("Account created, but no user session was returned.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

    if (profileError) {
      await supabase.auth.signOut();
      setAuthenticating(false);
      setError(profileError.message);
      return;
    }

    window.location.href = nextUrl ? decodeURIComponent(nextUrl) : "/diners";
  }

  async function handleNormalSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(signinEmail);
    const password = signinPassword;

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setAuthenticating(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setAuthenticating(false);
      setError(signInError.message);
      return;
    }

    window.location.href = nextUrl ? decodeURIComponent(nextUrl) : "/eat";
  }

  if (isSignedIn && !nextUrl) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#fcf5e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#213166",
          fontSize: 16,
          lineHeight: "24px",
        }}
      >
        Opening Whistle{email ? ` for ${email}` : ""}...
      </main>
    );
  }

  if (inviteContext) {
    return (
      <main style={inviteShellStyle()}>
        <div
          style={{
            width: "min(361px, 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <button
            type="button"
            onClick={() => (window.location.href = nextInvitePath.replace("?autoJoin=1", ""))}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "transparent",
              color: "#4a5565",
              fontSize: 14,
              lineHeight: "20px",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <Image
            src="/brand/logo/Whistle-Brand-Assets_lockup-vertical-light.svg"
            alt="Whistle"
            width={160}
            height={160}
            priority
            style={{ width: 160, height: 160, display: "block" }}
          />

          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: "20px",
              color: "#4a5565",
              textAlign: "center",
            }}
          >
            {authSubtitle}
          </p>

          <div style={inviteCardStyle()}>
            <div
              style={{
                fontSize: 24,
                lineHeight: "32px",
                fontWeight: 500,
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              {authTitle}
            </div>

            <form
              onSubmit={(event) =>
                inviteMode === "signup"
                  ? void handleInviteSignUp(event)
                  : void handleInviteSignIn(event)
              }
              style={{
                marginTop: 24,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <label htmlFor="invite-auth-email" style={fieldLabelStyle()}>
                  Email
                </label>
                <input
                  id="invite-auth-email"
                  type="email"
                  autoComplete="email"
                  value={inviteMode === "signup" ? signupEmail : signinEmail}
                  onChange={(event) => {
                    setError(null);
                    if (inviteMode === "signup") {
                      setSignupEmail(event.target.value);
                    } else {
                      setSigninEmail(event.target.value);
                    }
                  }}
                  placeholder="you@example.com"
                  style={{ ...inputStyle(), marginTop: 8 }}
                />
              </div>

              {inviteMode === "signup" ? (
                <div>
                  <label htmlFor="invite-auth-display-name" style={fieldLabelStyle()}>
                    Display name
                  </label>
                  <input
                    id="invite-auth-display-name"
                    autoComplete="nickname"
                    value={signupDisplayName}
                    onChange={(event) => {
                      setError(null);
                      setSignupDisplayName(event.target.value);
                    }}
                    placeholder="Pick a name your group knows"
                    style={{ ...inputStyle(), marginTop: 8 }}
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="invite-auth-password" style={fieldLabelStyle()}>
                  Password
                </label>
                <input
                  id="invite-auth-password"
                  type="password"
                  autoComplete={inviteMode === "signup" ? "new-password" : "current-password"}
                  value={inviteMode === "signup" ? signupPassword : signinPassword}
                  onChange={(event) => {
                    setError(null);
                    if (inviteMode === "signup") {
                      setSignupPassword(event.target.value);
                    } else {
                      setSigninPassword(event.target.value);
                    }
                  }}
                  placeholder={
                    inviteMode === "signup" ? "At least 8 characters" : "Enter your password"
                  }
                  style={{ ...inputStyle(), marginTop: 8 }}
                />
              </div>

              {error ? (
                <div
                  style={{
                    borderRadius: 10,
                    background: "#fef2f2",
                    color: "#b91c1c",
                    padding: "10px 12px",
                    fontSize: 13,
                    lineHeight: "18px",
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button type="submit" disabled={authenticating} style={primaryButtonStyle(authenticating)}>
                {authenticating
                  ? inviteMode === "signup"
                    ? "Creating account..."
                    : "Signing in..."
                  : inviteMode === "signup"
                    ? "Create account and join"
                    : "Sign in and join"}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <Link
                href={`/auth?invite=1&mode=${alternateMode}&groupName=${encodeURIComponent(
                  groupName
                )}&next=${encodeURIComponent(nextInvitePath)}`}
                style={{
                  color: "#1d4ed8",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {alternateLabel}
              </Link>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
              textAlign: "center",
              maxWidth: 362,
            }}
          >
            {inviteMode === "signup"
              ? "By creating an account, you agree to our Terms of Service and Privacy Policy"
              : "By signing in, you agree to our Terms of Service and Privacy Policy"}
          </p>
        </div>
      </main>
    );
  }

  const isNormalSignUp = normalAuthMode === "signup";
  const normalSubtitle = isNormalSignUp
    ? "Join and start exploring great meals"

    : "It's time to eat";


  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fcf5e8",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(361.5px, 100%)",
          minHeight: isNormalSignUp ? 718 : 632,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          color: "#213166",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Image
            src="/brand/logo/Whistle-Brand-Assets_lockup-vertical-light.svg"
            alt="Whistle"
            width={256}
            height={256}
            priority
            style={{
              width: "min(256px, 100%)",
              height: "auto",
              display: "block",
              margin: "0 auto",
            }}
          />

          <p
            style={{
              margin: "16px 0 0",
              fontSize: 18,
              lineHeight: "28px",
              fontWeight: 400,
              color: "#213166",
              textAlign: "center",
            }}
          >
            {normalSubtitle}
          </p>
        </div>

        <form
          onSubmit={(event) =>
            isNormalSignUp ? void handleNormalSignUp(event) : void handleNormalSignIn(event)
          }
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <label htmlFor="auth-email" style={{ ...fieldLabelStyle(), color: "#213166" }}>
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={isNormalSignUp ? signupEmail : signinEmail}
              onChange={(event) => {
                setError(null);
                if (isNormalSignUp) {
                  setSignupEmail(event.target.value);
                } else {
                  setSigninEmail(event.target.value);
                }
              }}
              placeholder="your.email@example.com"
              style={{ ...normalInputStyle(), marginTop: 8 }}
            />
          </div>

          {isNormalSignUp ? (
            <div>
              <label htmlFor="auth-display-name" style={{ ...fieldLabelStyle(), color: "#213166" }}>
                Display name
              </label>
              <input
                id="auth-display-name"
                autoComplete="nickname"
                value={signupDisplayName}
                onChange={(event) => {
                  setError(null);
                  setSignupDisplayName(event.target.value);
                }}
                placeholder="Pick a name your friends know"
                style={{ ...normalInputStyle(), marginTop: 8 }}
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="auth-password" style={{ ...fieldLabelStyle(), color: "#213166" }}>
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isNormalSignUp ? "new-password" : "current-password"}
              value={isNormalSignUp ? signupPassword : signinPassword}
              onChange={(event) => {
                setError(null);
                if (isNormalSignUp) {
                  setSignupPassword(event.target.value);
                } else {
                  setSigninPassword(event.target.value);
                }
              }}
              placeholder={isNormalSignUp ? "At least 8 characters" : "Enter your password"}
              style={{ ...normalInputStyle(), marginTop: 8 }}
            />
          </div>

          {error ? (
            <div
              style={{
                borderRadius: 10,
                background: "#fef2f2",
                color: "#b91c1c",
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: "18px",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={authenticating}
            style={{ ...normalPrimaryButtonStyle(authenticating), marginTop: 14 }}
          >
            {authenticating
              ? isNormalSignUp
                ? "Creating Account..."
                : "Signing In..."
              : isNormalSignUp
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <Link
            href={normalAuthHref(isNormalSignUp ? "signin" : "signup", nextUrl)}
            style={{
              color: "#062a61",
              fontSize: 14,
              lineHeight: "20px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            {isNormalSignUp ? "Already have an account? Sign In" : "Create Account"}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
