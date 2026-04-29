"use client";

import {
  Check,
  EllipsisVertical,
  Plus,
  Share,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

type InvitePhase =
  | "loading"
  | "invalid"
  | "landing"
  | "joining"
  | "joined"
  | "add-to-home-splash"
  | "add-to-home-instructions"
  | "redirecting";

type GroupMember = {
  user_id: string;
  display_name: string | null;
  role: "owner" | "member";
};

type InviteGroup = {
  id: string;
  name: string;
  ownerName: string;
  members: GroupMember[];
};

type InstallPlatform = "ios" | "android";

function pageShellStyle(): CSSProperties {
  return {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
    padding: "16px 16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function outerStackStyle(): CSSProperties {
  return {
    width: "min(361px, 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
  };
}

function cardStyle(minHeight?: number): CSSProperties {
  return {
    width: "100%",
    minHeight,
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.1)",
    padding: 32,
    boxSizing: "border-box",
  };
}

function primaryButtonStyle(): CSSProperties {
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
    cursor: "pointer",
  };
}

function secondaryButtonStyle(): CSSProperties {
  return {
    width: "100%",
    minHeight: 48,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fafafa",
    color: "#0a0a0a",
    fontSize: 18,
    lineHeight: "28px",
    fontWeight: 500,
    letterSpacing: "-0.44px",
    cursor: "pointer",
  };
}

function topBadge({
  icon,
  background,
  size = 96,
  accent,
}: {
  icon: React.ReactNode;
  background: string;
  size?: number;
  accent?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: 999,
        background,
        boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      {icon}
      {accent ? (
        <div style={{ position: "absolute", right: -2, bottom: -2 }}>{accent}</div>
      ) : null}
    </div>
  );
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function memberLabel(member: GroupMember) {
  if (member.role === "owner") return member.display_name?.trim() || "Owner";
  return member.display_name?.trim() || "Member";
}

function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "android";
  const userAgent = navigator.userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos ? "ios" : "android";
}

function buildAuthHref({
  token,
  mode,
  groupName,
}: {
  token: string;
  mode: "signin" | "signup";
  groupName: string;
}) {
  const params = new URLSearchParams({
    next: `/invite/${token}?autoJoin=1`,
    invite: "1",
    mode,
    groupName,
  });

  return `/auth?${params.toString()}`;
}

function LoadingCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={pageShellStyle()}>
      <div style={outerStackStyle()}>
        {topBadge({
          icon: <Users size={44} strokeWidth={2.1} />,
          background: "#d8b4fe",
        })}
        <div style={cardStyle(240)}>
          <div
            style={{
              fontSize: 30,
              lineHeight: "36px",
              fontWeight: 500,
              textAlign: "center",
              color: "#0a0a0a",
            }}
          >
            {title}
          </div>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: 16,
              lineHeight: "24px",
              textAlign: "center",
              color: "#4a5565",
            }}
          >
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InviteJoinPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoJoin = searchParams.get("autoJoin") === "1";

  const [phase, setPhase] = useState<InvitePhase>("loading");
  const [inviteGroup, setInviteGroup] = useState<InviteGroup | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const installPlatform = useMemo(() => detectInstallPlatform(), []);

  useEffect(() => {
    let active = true;

    async function validateInviteAndSession() {
      if (!token || typeof token !== "string") {
        if (!active) return;
        setPhase("invalid");
        return;
      }

      setPhase("loading");
      setError(null);

      const [{ data: sessionData, error: sessionError }, inviteResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc("group_by_invite", { p_token: token }).single(),
      ]);

      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        setPhase("invalid");
        return;
      }

      const uid = sessionData.session?.user?.id ?? null;
      setUserId(uid);

      if (inviteResult.error || !inviteResult.data) {
        setInviteGroup(null);
        setPhase("invalid");
        return;
      }

      const group = inviteResult.data as { id: string; name: string };
      const { data: membersData } = await supabase.rpc("members_for_group", {
        p_group_id: group.id,
      });

      if (!active) return;

      const members = ((membersData ?? []) as GroupMember[]).sort((a, b) => {
        if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
        return (a.display_name ?? "").localeCompare(b.display_name ?? "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
      });
      const ownerName =
        members.find((member) => member.role === "owner")?.display_name?.trim() || "Someone";

      const nextInviteGroup: InviteGroup = {
        id: group.id,
        name: group.name,
        ownerName,
        members,
      };

      setInviteGroup(nextInviteGroup);

      const alreadyMember = uid
        ? members.some((member) => member.user_id === uid)
        : false;

      if (uid && (autoJoin || alreadyMember)) {
        await completeJoin(nextInviteGroup, uid, alreadyMember);
        return;
      }

      setPhase("landing");
    }

    async function completeJoin(group: InviteGroup, uid: string, alreadyMember = false) {
      if (!active) return;

      setPhase("joining");
      setError(null);

      if (alreadyMember) {
        setPhase("joined");
        return;
      }

      const { error: joinError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: uid, role: "member" });

      if (!active) return;

      if (joinError && !String(joinError.message).toLowerCase().includes("duplicate")) {
        setError(joinError.message);
        setPhase("landing");
        return;
      }

      setPhase("joined");
    }

    void validateInviteAndSession();

    return () => {
      active = false;
    };
  }, [autoJoin, token]);

  async function handleJoinGroup() {
    if (!inviteGroup || !token) return;

    if (!userId) {
      window.location.href = buildAuthHref({
        token,
        mode: "signup",
        groupName: inviteGroup.name,
      });
      return;
    }

    const alreadyMember = inviteGroup.members.some((member) => member.user_id === userId);

    setPhase("joining");
    setError(null);

    if (alreadyMember) {
      setPhase("joined");
      return;
    }

    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: inviteGroup.id, user_id: userId, role: "member" });

    if (joinError && !String(joinError.message).toLowerCase().includes("duplicate")) {
      setError(joinError.message);
      setPhase("landing");
      return;
    }

    setPhase("joined");
  }

  function handleContinueFromSuccess() {
    setPhase("add-to-home-splash");
  }

  function handleOpenInstallInstructions() {
    setPhase("add-to-home-instructions");
  }

  function handleFinishFlow() {
    setPhase("redirecting");
    router.replace("/diners");
  }

  if (phase === "loading") {
    return <LoadingCard title="Checking invite..." body="Validating your group invite now." />;
  }

  if (phase === "joining") {
    return <LoadingCard title="Joining group..." body="Adding you to this dining group." />;
  }

  if (phase === "redirecting") {
    return <LoadingCard title="Opening Diners..." body="Taking you to your new group now." />;
  }

  if (phase === "invalid") {
    return (
      <div style={pageShellStyle()}>
        <div style={outerStackStyle()}>
          {topBadge({
            icon: <X size={38} color="#9ca3af" strokeWidth={2.3} />,
            background: "#f3f4f6",
            size: 80,
          })}
          <div style={cardStyle(272)}>
            <div
              style={{
                fontSize: 24,
                lineHeight: "32px",
                fontWeight: 500,
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              This invite is no longer active
            </div>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 16,
                lineHeight: "24px",
                color: "#4a5565",
                textAlign: "center",
              }}
            >
              Ask the group owner to send you a new invite link.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              style={{ ...secondaryButtonStyle(), marginTop: 32 }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!inviteGroup) {
    return <LoadingCard title="Loading..." body="Preparing your invite." />;
  }

  if (phase === "landing") {
    return (
      <div style={pageShellStyle()}>
        <div style={outerStackStyle()}>
          {topBadge({
            icon: <Users size={44} strokeWidth={2.1} />,
            background: "#d8b4fe",
          })}
          <div style={cardStyle(440)}>
            <div
              style={{
                fontSize: 30,
                lineHeight: "36px",
                fontWeight: 500,
                letterSpacing: "0.4px",
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              {inviteGroup.name}
            </div>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 16,
                lineHeight: "24px",
                color: "#4a5565",
                textAlign: "center",
              }}
            >
              <span style={{ fontWeight: 600 }}>{inviteGroup.ownerName}</span> invited you to join
              this dining group
            </p>

            <div style={{ marginTop: 24, textAlign: "center", color: "#364153" }}>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                }}
              >
                {inviteGroup.members.length} members
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {inviteGroup.members.map((member) => (
                  <div
                    key={member.user_id}
                    style={{
                      width: "fit-content",
                      minWidth: 142,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        background: "linear-gradient(135deg, #51a2ff 0%, #155dfc 100%)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        lineHeight: "20px",
                        fontWeight: 600,
                      }}
                    >
                      {initialsFromName(memberLabel(member))}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: "20px",
                        color: "#364153",
                      }}
                    >
                      {memberLabel(member)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div
                style={{
                  marginTop: 20,
                  borderRadius: 12,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: "12px 14px",
                  fontSize: 13,
                  lineHeight: "18px",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleJoinGroup()}
              style={{ ...primaryButtonStyle(), marginTop: 24 }}
            >
              Join group
            </button>

            {!userId && token ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = buildAuthHref({
                    token,
                    mode: "signin",
                    groupName: inviteGroup.name,
                  });
                }}
                style={{
                  marginTop: 20,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  color: "#1d4ed8",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Already have an account? Sign in
              </button>
            ) : null}
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
            By joining, you&apos;ll be able to participate in dining events with this group
          </p>
        </div>
      </div>
    );
  }

  if (phase === "joined") {
    return (
      <div style={pageShellStyle()}>
        <div style={outerStackStyle()}>
          {topBadge({
            icon: <Users size={44} strokeWidth={2.1} />,
            background: "#d8b4fe",
            accent: (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  background: "#00c950",
                  border: "4px solid white",
                  boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                <Check size={24} strokeWidth={2.5} />
              </div>
            ),
          })}
          <div style={cardStyle(350)}>
            <div
              style={{
                fontSize: 30,
                lineHeight: "36px",
                fontWeight: 500,
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              Welcome!
            </div>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 16,
                lineHeight: "24px",
                color: "#4a5565",
                textAlign: "center",
              }}
            >
              You&apos;ve successfully joined <span style={{ fontWeight: 600 }}>{inviteGroup.name}</span>
            </p>

            <div
              style={{
                marginTop: 24,
                borderRadius: 12,
                border: "1px solid #bedbff",
                background: "#eff6ff",
                padding: "18px 16px",
                fontSize: 14,
                lineHeight: "20px",
                color: "#1c398e",
                textAlign: "center",
              }}
            >
              You can now participate in dining events and discover restaurants with your group.
            </div>

            <button
              type="button"
              onClick={handleContinueFromSuccess}
              style={{ ...primaryButtonStyle(), marginTop: 24 }}
            >
              Continue
            </button>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
              textAlign: "center",
            }}
          >
            Get started by exploring the group&apos;s restaurant list
          </p>
        </div>
      </div>
    );
  }

  if (phase === "add-to-home-splash") {
    return (
      <div style={pageShellStyle()}>
        <div style={outerStackStyle()}>
          {topBadge({
            icon: <Smartphone size={36} strokeWidth={2.1} />,
            background: "linear-gradient(135deg, #2b7fff 0%, #1447e6 100%)",
            size: 80,
          })}
          <div style={cardStyle(356)}>
            <div
              style={{
                fontSize: 24,
                lineHeight: "32px",
                fontWeight: 500,
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              Add Restaurant App to your Home Screen
            </div>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 16,
                lineHeight: "24px",
                color: "#4a5565",
                textAlign: "center",
              }}
            >
              Get quick access to your dining groups and restaurant lists right from your home
              screen.
            </p>

            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                type="button"
                onClick={handleOpenInstallInstructions}
                style={primaryButtonStyle()}
              >
                Add to Home Screen
              </button>
              <button
                type="button"
                onClick={handleFinishFlow}
                style={secondaryButtonStyle()}
              >
                Maybe later
              </button>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
              textAlign: "center",
            }}
          >
            You can always add this later from your browser settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShellStyle()}>
      <div style={outerStackStyle()}>
        <div style={cardStyle(installPlatform === "ios" ? 524 : 548)}>
          <div
            style={{
              fontSize: 24,
              lineHeight: "32px",
              fontWeight: 500,
              color: "#0a0a0a",
              textAlign: "center",
            }}
          >
            Add to Home Screen
          </div>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 16,
              lineHeight: "24px",
              color: "#4a5565",
              textAlign: "center",
            }}
          >
            {installPlatform === "ios"
              ? "Follow these steps to add the app to your iPhone home screen:"
              : "Follow these steps to add the app to your Android home screen:"}
          </p>

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>
            {(installPlatform === "ios"
              ? [
                  {
                    title: "Open in Safari",
                    body: "Make sure you're viewing this page in Safari browser",
                  },
                  {
                    title: "Tap Share",
                    body: "Tap the Share icon at the bottom of your screen",
                    icon: <Share size={16} color="#155dfc" />,
                  },
                  {
                    title: 'Tap "Add to Home Screen"',
                    body: 'Scroll down and select "Add to Home Screen"',
                    icon: <Plus size={16} color="#155dfc" />,
                  },
                ]
              : [
                  {
                    title: "Open browser menu",
                    body: "Tap the three dots menu at the top right",
                    icon: <EllipsisVertical size={16} color="#155dfc" />,
                  },
                  {
                    title: 'Tap "Add to home screen" or "Install"',
                    body: "Select the option to add or install the app",
                    icon: <Plus size={16} color="#155dfc" />,
                  },
                  {
                    title: "Confirm installation",
                    body: 'Tap "Add" or "Install" in the confirmation dialog',
                  },
                ]
            ).map((step, index) => (
              <div key={step.title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: "#dbeafe",
                    color: "#1447e6",
                    fontSize: 16,
                    lineHeight: "24px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 16,
                      lineHeight: "24px",
                      fontWeight: 500,
                      color: "#0a0a0a",
                    }}
                  >
                    <span>{step.title}</span>
                    {step.icon ?? null}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 14,
                      lineHeight: "20px",
                      color: "#4a5565",
                    }}
                  >
                    {step.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleFinishFlow}
            style={{ ...primaryButtonStyle(), marginTop: 32 }}
          >
            Done
          </button>
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
          {installPlatform === "ios"
            ? "You can skip this step and add the app later from Safari"
            : "You can skip this step and add the app later from your browser menu"}
        </p>
      </div>
    </div>
  );
}
