"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Crown,
  MapPin,
  Search,
  UserRoundPlus,
  X,
} from "lucide-react";

export type EditableGroupMember = {
  user_id: string;
  display_name: string | null;
  role: "owner" | "member";
};

export type DiningAreaValue = {
  label: string;
  lat: number;
  lng: number;
  placeId: string;
  types: string[];
  formattedAddress: string | null;
};

type CreateEditGroupModalProps = {
  mode: "create" | "edit";
  groupName: string;
  members: EditableGroupMember[];
  ownerUserId?: string | null;
  currentUserId: string | null;
  initialDiningArea?: DiningAreaValue | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: {
    name: string;
    diningArea: DiningAreaValue | null;
    removedMemberUserIds: string[];
  }) => Promise<void> | void;
  onInviteMember?: () => void;
  onArchive?: () => Promise<void> | void;
};

type AreaSuggestion = {
  place_id: string;
  label: string;
  types: string[];
  query_text?: string;
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

function sectionLabelStyle(): CSSProperties {
  return {
    fontSize: 14,
    lineHeight: "14px",
    fontWeight: 500,
    letterSpacing: "-0.15px",
    color: "#0a0a0a",
  };
}

function memberRowName(member: EditableGroupMember, currentUserId: string | null) {
  if (member.user_id === currentUserId) return "You (You)";
  return member.display_name?.trim() || "Unknown";
}

function createSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `dining-area-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function deriveSuggestionSubtitle(types: string[]) {
  if (types.length === 0) return "General area";

  if (types.includes("derived_query")) return "Suggested location";

  return types
    .slice(0, 2)
    .map((entry) =>
      entry
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .join(" • ");
}

function buildGoogleMapEmbedUrl(location: DiningAreaValue) {
  const params = new URLSearchParams({
    q: `${location.lat},${location.lng}`,
    z: "13",
    output: "embed",
  });

  return `https://www.google.com/maps?${params.toString()}`;
}

function DiningAreaDialogShell({
  initialDiningArea,
  onClose,
  onSave,
}: {
  initialDiningArea: DiningAreaValue | null;
  onClose: () => void;
  onSave: (nextValue: DiningAreaValue) => void;
}) {
  const [query, setQuery] = useState(initialDiningArea?.label ?? "");
  const [resolvedArea, setResolvedArea] = useState<DiningAreaValue | null>(initialDiningArea);
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken] = useState(() => createSessionToken());

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function searchAreas() {
    const nextQuery = query.trim();
    if (!nextQuery) return;

    setSearching(true);
    setError(null);
    setSuggestions([]);
    setResolvedArea(null);

    try {
      const params = new URLSearchParams({
        input: nextQuery,
        sessionToken,
      });

      const response = await fetch(`/api/places/area-autocomplete?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        error?: string;
        suggestions?: AreaSuggestion[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to search dining locations right now.");
        return;
      }

      const nextSuggestions = payload.suggestions ?? [];
      if (nextSuggestions.length === 0) {
        setError(
          "We couldn't recognize that location. Try an address, ZIP code, neighborhood, district, or town/city area."
        );
        return;
      }

      setSuggestions(nextSuggestions);
    } catch {
      setError("Unable to search dining locations right now.");
    } finally {
      setSearching(false);
    }
  }

  async function resolveSuggestion(suggestion: AreaSuggestion) {
    setResolvingPlaceId(suggestion.place_id);
    setError(null);

    try {
      const params = new URLSearchParams({
        sessionToken,
      });

      if (suggestion.query_text) {
        params.set("query", suggestion.query_text);
      } else {
        params.set("place_id", suggestion.place_id);
      }

      const response = await fetch(`/api/places/area-details?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        error?: string;
        result?: {
          label: string;
          place_id: string;
          lat: number | null;
          lng: number | null;
          types?: string[];
          formatted_address?: string | null;
        };
      };

      if (!response.ok || !payload.result) {
        setResolvedArea(null);
        setError(
          payload.error ??
            "We couldn't resolve that location. Try a more specific address or a nearby area."
        );
        return;
      }

      if (
        !payload.result.place_id ||
        payload.result.lat == null ||
        payload.result.lng == null
      ) {
        setResolvedArea(null);
        setError(
          "We couldn't resolve that location with coordinates. Try refining your search."
        );
        return;
      }

      const nextArea: DiningAreaValue = {
        label: payload.result.label,
        lat: payload.result.lat,
        lng: payload.result.lng,
        placeId: payload.result.place_id,
        types: payload.result.types ?? [],
        formattedAddress: payload.result.formatted_address ?? null,
      };

      setQuery(nextArea.label);
      setResolvedArea(nextArea);
      setSuggestions([]);
    } catch {
      setResolvedArea(null);
      setError("Unable to resolve that dining location right now.");
    } finally {
      setResolvingPlaceId(null);
    }
  }

  const canSearch = query.trim().length > 0 && !searching && !resolvingPlaceId;
  const canConfirm = resolvedArea !== null && !searching && !resolvingPlaceId;
  const mapEmbedUrl = resolvedArea ? buildGoogleMapEmbedUrl(resolvedArea) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set your group's home dining area"
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
          width: "min(393px, 100%)",
          maxHeight: "min(594px, calc(100vh - 24px))",
          background: "#fafafa",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
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
            Set your group&apos;s home dining area
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dining area dialog"
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
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: "20px",
              letterSpacing: "-0.15px",
              color: "#717182",
              textAlign: "center",
            }}
          >
            Used as the default location for distance and nearby restaurant search.
          </p>
        </div>

        <div style={{ padding: "16px 24px 0", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={sectionLabelStyle()}>Group dining area</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search
                    size={16}
                    color="#9ca3af"
                    style={{ position: "absolute", left: 12, top: 10 }}
                  />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setError(null);
                      setSuggestions([]);
                      setResolvedArea(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void searchAreas();
                      }
                    }}
                    placeholder="Search address, ZIP code, neighborhood, or area"
                    style={{ ...inputStyle(), paddingLeft: 40 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void searchAreas()}
                  disabled={!canSearch}
                  style={{
                    width: 78,
                    height: 36,
                    border: "none",
                    borderRadius: 10,
                    background: "#1d4ed8",
                    color: "white",
                    fontSize: 14,
                    lineHeight: "20px",
                    fontWeight: 500,
                    letterSpacing: "-0.15px",
                    cursor: canSearch ? "pointer" : "default",
                    opacity: canSearch ? 1 : 0.5,
                  }}
                >
                  {searching ? "..." : "Search"}
                </button>
              </div>
            </div>

            {error ? (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #fca5a5",
                  background: "#fef2f2",
                  padding: "10px 12px",
                  fontSize: 13,
                  lineHeight: "18px",
                  color: "#b91c1c",
                }}
              >
                {error}
              </div>
            ) : null}

            {suggestions.length > 0 ? (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "white",
                  overflow: "hidden",
                }}
              >
                {suggestions.map((suggestion, index) => {
                  const resolving = resolvingPlaceId === suggestion.place_id;

                  return (
                    <button
                      key={suggestion.place_id}
                      type="button"
                      onClick={() => void resolveSuggestion(suggestion)}
                      disabled={Boolean(resolvingPlaceId)}
                      style={{
                        width: "100%",
                        border: "none",
                        borderTop:
                          index === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                        background: resolving ? "#eff6ff" : "white",
                        padding: "12px 14px",
                        textAlign: "left",
                        cursor: resolvingPlaceId ? "default" : "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: "20px",
                          fontWeight: 500,
                          letterSpacing: "-0.15px",
                          color: "#0a0a0a",
                        }}
                      >
                        {suggestion.label}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          lineHeight: "16px",
                          color: resolving ? "#1d4ed8" : "#6a7282",
                        }}
                      >
                        {resolving
                          ? "Resolving area..."
                          : deriveSuggestionSubtitle(suggestion.types)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {resolvedArea ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    borderRadius: 10,
                    border: "1px solid #bedbff",
                    background: "#eff6ff",
                    padding: 12,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <MapPin size={16} color="#155dfc" style={{ marginTop: 1 }} />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: "20px",
                        fontWeight: 500,
                        letterSpacing: "-0.15px",
                        color: "#1c398e",
                      }}
                    >
                      {resolvedArea.label}
                    </div>
                    {resolvedArea.formattedAddress &&
                    resolvedArea.formattedAddress !== resolvedArea.label ? (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            lineHeight: "16px",
                            color: "#1d4ed8",
                          }}
                        >
                          {resolvedArea.formattedAddress}
                        </div>
                      ) : null}
                  </div>
                </div>

                <div
                  style={{
                    minHeight: 194,
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#f3f4f6",
                    overflow: "hidden",
                  }}
                >
                  {mapEmbedUrl ? (
                    <iframe
                      title={`Map preview for ${resolvedArea.label}`}
                      src={mapEmbedUrl}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{
                        width: "100%",
                        height: 194,
                        border: "none",
                      }}
                    />
                  ) : null}
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "#4a5565",
                  }}
                >
                  You can zoom and pan the map to double-check the location. This won&apos;t
                  change the saved dining location.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            padding: "16px 24px 24px",
            display: "flex",
            gap: 8,
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
              letterSpacing: "-0.15px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!resolvedArea) return;
              onSave(resolvedArea);
            }}
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
              letterSpacing: "-0.15px",
              cursor: canConfirm ? "pointer" : "default",
              opacity: canConfirm ? 1 : 0.5,
            }}
          >
            Confirm &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateEditGroupModal({
  mode,
  groupName,
  members,
  ownerUserId = null,
  currentUserId,
  initialDiningArea = null,
  saving = false,
  error = null,
  onClose,
  onSave,
  onInviteMember,
  onArchive,
}: CreateEditGroupModalProps) {
  const [name, setName] = useState(groupName);
  const [diningArea, setDiningArea] = useState<DiningAreaValue | null>(initialDiningArea);
  const [diningAreaDialogOpen, setDiningAreaDialogOpen] = useState(false);
  const [archiveConfirmationOpen, setArchiveConfirmationOpen] = useState(false);
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [removedMemberUserIds, setRemovedMemberUserIds] = useState<string[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (archiveConfirmationOpen) {
        setArchiveConfirmationOpen(false);
        return;
      }

      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [archiveConfirmationOpen, onClose]);

  const title = mode === "create" ? "Create New Group" : "Edit Group";
  const primaryLabel = mode === "create" ? "Create Group" : "Save Changes";
  const canSubmit = name.trim().length > 0 && diningArea !== null && !saving;
  const visibleMembers = useMemo(
    () => members.filter((member) => !removedMemberUserIds.includes(member.user_id)),
    [members, removedMemberUserIds]
  );
  const membersCount = visibleMembers.length;
  const stagedRemovalCount = removedMemberUserIds.length;
  const sortedMembers = useMemo(() => {
    return [...visibleMembers].sort((a, b) => {
      if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "", undefined, {
        sensitivity: "base",
        numeric: true,
      });
    });
  }, [visibleMembers]);

  const showMembersSection = mode === "edit";
  const canManageMembers = mode === "edit" && ownerUserId != null && ownerUserId === currentUserId;
  const canArchiveGroup = canManageMembers && Boolean(onArchive);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 140,
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
            width: "min(393px, 100%)",
            maxHeight: "min(617px, calc(100vh - 24px))",
            background: "#fafafa",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
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
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
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
              padding: "24px 24px 0",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <section>
              <div style={sectionLabelStyle()}>Group Name</div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g., Work Friends, Family, etc."
                style={{ ...inputStyle(), marginTop: 8 }}
              />
            </section>

            <section>
              <div style={sectionLabelStyle()}>Group Dining Area</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div
                  style={{
                    flex: 1,
                    minHeight: 37,
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "#4a5565",
                  }}
                >
                  {diningArea?.label || "No dining area set"}
                </div>
                <button
                  type="button"
                  onClick={() => setDiningAreaDialogOpen(true)}
                  style={{
                    width: 51,
                    height: 32,
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "#fafafa",
                    color: "#0a0a0a",
                    fontSize: 14,
                    lineHeight: "20px",
                    fontWeight: 500,
                    letterSpacing: "-0.15px",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
              </div>
              {!diningArea ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "#6a7282",
                  }}
                >
                  Default dining location is required.
                </div>
              ) : null}
            </section>

            {showMembersSection ? (
              <section>
                <div style={sectionLabelStyle()}>Members ({membersCount})</div>
                <div
                  style={{
                    marginTop: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "white",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {sortedMembers.map((member) => {
                    const isSelf = member.user_id === currentUserId;
                    const isOwner = member.user_id === ownerUserId;
                    const canRemoveMember = canManageMembers && !isOwner;

                    return (
                      <div
                        key={member.user_id}
                        style={{
                          minHeight: isSelf ? 36 : 40,
                          borderRadius: 10,
                          background: "#f9fafb",
                          padding: "8px 8px 8px 8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isOwner ? <Crown size={12} color="#d97706" /> : null}
                          <span
                            style={{
                              fontSize: 14,
                              lineHeight: "20px",
                              color: "#0a0a0a",
                              letterSpacing: "-0.15px",
                            }}
                          >
                            {memberRowName(member, currentUserId)}
                          </span>
                        </div>

                        {canRemoveMember ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRemovedMemberUserIds((current) =>
                                current.includes(member.user_id)
                                  ? current
                                  : [...current, member.user_id]
                              );
                            }}
                            aria-label={`Remove ${memberRowName(member, currentUserId)}`}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 10,
                              border: "none",
                              background: "transparent",
                              color: "#ef4444",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <X size={16} />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {stagedRemovalCount > 0 ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      lineHeight: "16px",
                      color: "#6a7282",
                    }}
                  >
                    {stagedRemovalCount === 1
                      ? "1 member will be removed when you save."
                      : `${stagedRemovalCount} members will be removed when you save.`}
                  </div>
                ) : null}

                {canManageMembers && onInviteMember ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHelperMessage(null);
                      onInviteMember();
                    }}
                    style={{
                      marginTop: 16,
                      width: "100%",
                      minHeight: 36,
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#fafafa",
                      color: "#0a0a0a",
                      fontSize: 14,
                      lineHeight: "20px",
                      fontWeight: 500,
                      letterSpacing: "-0.15px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <UserRoundPlus size={16} />
                    <span>Invite member</span>
                  </button>
                ) : null}

                {canArchiveGroup ? (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        if (saving) return;
                        setHelperMessage(null);
                        setArchiveConfirmationOpen(true);
                      }}
                      style={{
                        width: "100%",
                        minHeight: 36,
                        borderRadius: 10,
                        border: "1px solid #ffa2a2",
                        background: "#fafafa",
                        color: "#e7000b",
                        fontSize: 14,
                        lineHeight: "20px",
                        fontWeight: 500,
                        letterSpacing: "-0.15px",
                        cursor: saving ? "default" : "pointer",
                        opacity: saving ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <Archive size={16} />
                      <span>Archive Group</span>
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {helperMessage ? (
              <div
                style={{
                  fontSize: 12,
                  lineHeight: "16px",
                  color: "#4a5565",
                }}
              >
                {helperMessage}
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  fontSize: 12,
                  lineHeight: "16px",
                  color: "crimson",
                }}
              >
                {error}
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: "16px 24px",
              borderTop: "1px solid rgba(0,0,0,0.08)",
              background: "white",
              display: "flex",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
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
                letterSpacing: "-0.15px",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canSubmit) return;
                onSave({ name, diningArea, removedMemberUserIds });
              }}
              disabled={!canSubmit}
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
                letterSpacing: "-0.15px",
                cursor: canSubmit ? "pointer" : "default",
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              {saving ? "Saving..." : primaryLabel}
            </button>
          </div>
        </div>
      </div>

      {diningAreaDialogOpen ? (
        <DiningAreaDialogShell
          initialDiningArea={diningArea}
          onClose={() => setDiningAreaDialogOpen(false)}
          onSave={(nextValue) => {
            setDiningArea(nextValue);
            setDiningAreaDialogOpen(false);
          }}
        />
      ) : null}

      {archiveConfirmationOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-group-title"
          aria-describedby="archive-group-description"
          onClick={() => setArchiveConfirmationOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 180,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(360px, 100%)",
              borderRadius: 12,
              background: "#fafafa",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)",
              padding: 24,
            }}
          >
            <div
              id="archive-group-title"
              style={{
                fontSize: 20,
                lineHeight: "28px",
                fontWeight: 600,
                color: "#0a0a0a",
                textAlign: "center",
              }}
            >
              Archive this group?
            </div>
            <p
              id="archive-group-description"
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: "20px",
                color: "#4a5565",
                textAlign: "center",
              }}
            >
              This will remove the group from active use and it cannot be undone.
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setArchiveConfirmationOpen(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fafafa",
                  color: "#0a0a0a",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  setArchiveConfirmationOpen(false);
                  onArchive?.();
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: "#dc2626",
                  color: "white",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 500,
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Archive Group
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
