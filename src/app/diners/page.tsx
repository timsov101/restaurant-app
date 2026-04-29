"use client";

import { CircleUserRound, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import UserProfileModal from "@/components/account/UserProfileModal";
import CreateEditGroupModal, {
  type DiningAreaValue,
  type EditableGroupMember,
} from "@/components/diners/CreateEditGroupModal";
import GroupInviteModal from "@/components/diners/GroupInviteModal";
import GroupOverviewCard from "@/components/diners/GroupOverviewCard";
import { buildGroupInviteUrl, ensureGroupHasInviteToken } from "@/lib/groupInvite";
import { supabase } from "@/lib/supabaseClient";

type Group = {
  id: string;
  name: string;
  owner_id: string;
  invite_token: string | null;
  created_at: string;
  location_label: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
};

type Member = EditableGroupMember;

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; groupId: string }
  | null;

type InviteModalState = {
  groupId: string;
  groupName: string;
  inviteUrl: string;
} | null;

type PendingInviteRevoke = {
  groupId: string;
  groupName: string;
  inviteToken: string;
} | null;

function sortMembers(members: Member[]) {
  return [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return (a.display_name ?? "").localeCompare(b.display_name ?? "", undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

function RevokeInviteToast({
  groupName,
  onUndo,
}: {
  groupName: string;
  onUndo: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 96,
        transform: "translateX(-50%)",
        width: "min(calc(100vw - 24px), 360px)",
        zIndex: 60,
        background: "white",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 12px",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#0a0a0a",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          flex: "0 0 auto",
        }}
      >
        ✓
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          lineHeight: 1.5,
          fontWeight: 500,
          color: "#0a0a0a",
        }}
      >
        Invite revoked for {groupName}
      </div>
      <button
        type="button"
        onClick={onUndo}
        style={{
          border: "none",
          borderRadius: 4,
          background: "#0a0a0a",
          color: "white",
          height: 24,
          padding: "0 10px",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          flex: "0 0 auto",
        }}
      >
        Undo
      </button>
    </div>
  );
}

export default function DinersPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Record<string, Member[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [inviteModalState, setInviteModalState] = useState<InviteModalState>(null);
  const [pendingInviteRevoke, setPendingInviteRevoke] = useState<PendingInviteRevoke>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const revokeToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (revokeToastTimerRef.current) {
        window.clearTimeout(revokeToastTimerRef.current);
      }
    };
  }, []);

  async function loadGroups(uid: string) {
    const { data, error: groupsError } = await supabase
      .from("group_members")
      .select(
        "groups ( id, name, owner_id, invite_token, created_at, location_label, location_lat, location_lng, location_place_id )"
      )
      .eq("user_id", uid);

    if (groupsError) {
      setError(groupsError.message);
      setGroups([]);
      return [];
    }

    const nextGroups = (data ?? [])
      .map((row: { groups: Group | null }) => row.groups)
      .filter(Boolean) as Group[];

    nextGroups.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setGroups(nextGroups);
    return nextGroups;
  }

  async function loadMembersForGroups(nextGroups: Group[]) {
    const nextMembersByGroup = await Promise.all(
      nextGroups.map(async (group) => {
        const { data, error: membersError } = await supabase.rpc("members_for_group", {
          p_group_id: group.id,
        });

        if (membersError) {
          setError(`Members load failed for ${group.name}: ${membersError.message}`);
          return [group.id, []] as const;
        }

        return [group.id, sortMembers((data ?? []) as Member[])] as const;
      })
    );

    setMembersByGroup(Object.fromEntries(nextMembersByGroup));
  }

  async function refreshGroups(uid: string) {
    setError(null);
    const nextGroups = await loadGroups(uid);
    await loadMembersForGroups(nextGroups);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      const uid = data.session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        window.location.href = "/auth?next=%2Fdiners";
        return;
      }

      await refreshGroups(uid);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGroups = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return groups;

    return groups.filter((group) => {
      const members = membersByGroup[group.id] ?? [];
      const matchesGroup = group.name.toLowerCase().includes(term);
      const matchesMember = members.some((member) =>
        (member.display_name ?? "").toLowerCase().includes(term)
      );

      return matchesGroup || matchesMember;
    });
  }, [groups, membersByGroup, searchQuery]);

  const activeEditGroup =
    modalState?.mode === "edit"
      ? groups.find((group) => group.id === modalState.groupId) ?? null
      : null;

  async function handleRevokeInvite(groupId: string) {
    setError(null);
    setNotice(null);
    const group = groups.find((entry) => entry.id === groupId);
    const previousInviteToken = group?.invite_token;

    if (!group || !previousInviteToken) return;

    const { error: revokeError } = await supabase
      .from("groups")
      .update({ invite_token: null })
      .eq("id", groupId);

    if (revokeError) {
      setError(revokeError.message);
      return;
    }

    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
            ...group,
            invite_token: null,
          }
          : group
      )
    );
    setInviteModalState((current) => (current?.groupId === groupId ? null : current));

    if (revokeToastTimerRef.current) {
      window.clearTimeout(revokeToastTimerRef.current);
    }

    setPendingInviteRevoke({
      groupId,
      groupName: group.name,
      inviteToken: previousInviteToken,
    });

    revokeToastTimerRef.current = window.setTimeout(() => {
      setPendingInviteRevoke(null);
      revokeToastTimerRef.current = null;
    }, 5000);
  }

  async function handleUndoRevokeInvite() {
    if (!pendingInviteRevoke) return;

    const restoreEntry = pendingInviteRevoke;

    if (revokeToastTimerRef.current) {
      window.clearTimeout(revokeToastTimerRef.current);
      revokeToastTimerRef.current = null;
    }

    setPendingInviteRevoke(null);
    setError(null);

    const { error: restoreError } = await supabase
      .from("groups")
      .update({ invite_token: restoreEntry.inviteToken })
      .eq("id", restoreEntry.groupId);

    if (restoreError) {
      setError(restoreError.message);
      return;
    }

    updateGroupInviteToken(restoreEntry.groupId, restoreEntry.inviteToken);
  }

  function updateGroupInviteToken(groupId: string, inviteToken: string) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
            ...group,
            invite_token: inviteToken,
          }
          : group
      )
    );
  }

  async function openGroupInvite(group: Group) {
    setError(null);
    setNotice(null);

    try {
      const inviteToken = await ensureGroupHasInviteToken({
        inviteToken: group.invite_token,
        persistInviteToken: async (nextToken) => {
          const { error: updateError } = await supabase
            .from("groups")
            .update({ invite_token: nextToken })
            .eq("id", group.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          if (!userId) {
            throw new Error("Not signed in.");
          }

          const { data: groupMemberRow, error: readBackError } = await supabase
            .from("group_members")
            .select("groups ( invite_token )")
            .eq("user_id", userId)
            .eq("group_id", group.id)
            .maybeSingle();

          if (readBackError) {
            throw new Error(readBackError.message);
          }

          const persistedInviteToken = (groupMemberRow as { groups?: { invite_token: string | null } | null } | null)
            ?.groups?.invite_token;
          if (!persistedInviteToken) {
            throw new Error("Invite token was not returned after saving.");
          }

          updateGroupInviteToken(group.id, persistedInviteToken);
          return persistedInviteToken;
        },
      });

      setInviteModalState({
        groupId: group.id,
        groupName: group.name,
        inviteUrl: buildGroupInviteUrl(inviteToken),
      });
    } catch (inviteError) {
      const message =
        inviteError instanceof Error
          ? inviteError.message
          : "Unable to prepare an invite link right now.";
      setError(message);
    }
  }

  async function handleCreateGroup(values: {
    name: string;
    diningArea: DiningAreaValue | null;
    removedMemberUserIds: string[];
  }) {
    const name = values.name.trim();
    if (!name) {
      setError("Please enter a group name.");
      return;
    }
    if (!userId) {
      setError("Not signed in.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { data: createdGroup, error: createError } = await supabase
      .from("groups")
      .insert({
        name,
        owner_id: userId,
        location_label: values.diningArea?.label ?? null,
        location_lat: values.diningArea?.lat ?? null,
        location_lng: values.diningArea?.lng ?? null,
        location_place_id: values.diningArea?.placeId ?? null,
      })
      .select(
        "id, name, owner_id, invite_token, created_at, location_label, location_lat, location_lng, location_place_id"
      )
      .single();

    if (createError) {
      setSaving(false);
      setError(createError.message);
      return;
    }

    const { error: membershipError } = await supabase
      .from("group_members")
      .insert({ group_id: createdGroup.id, user_id: userId, role: "owner" });

    if (membershipError) {
      setSaving(false);
      setError(membershipError.message);
      return;
    }

    await refreshGroups(userId);
    setSaving(false);
    setModalState(null);
  }

  async function handleEditGroup(values: {
    name: string;
    diningArea: DiningAreaValue | null;
    removedMemberUserIds: string[];
  }) {
    if (!activeEditGroup) return;

    const name = values.name.trim();
    if (!name) {
      setError("Please enter a group name.");
      return;
    }

    if (!userId) {
      setError("Not signed in.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { error: updateError } = await supabase
      .from("groups")
      .update({
        name,
        location_label: values.diningArea?.label ?? null,
        location_lat: values.diningArea?.lat ?? null,
        location_lng: values.diningArea?.lng ?? null,
        location_place_id: values.diningArea?.placeId ?? null,
      })
      .eq("id", activeEditGroup.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    if (values.removedMemberUserIds.length > 0) {
      if (activeEditGroup.owner_id !== userId) {
        setSaving(false);
        setError("Only the group owner can remove diners.");
        return;
      }

      if (values.removedMemberUserIds.includes(activeEditGroup.owner_id)) {
        setSaving(false);
        setError("The group owner cannot be removed.");
        return;
      }

      const { error: removeError } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", activeEditGroup.id)
        .in("user_id", values.removedMemberUserIds);

      if (removeError) {
        setSaving(false);
        setError(removeError.message);
        return;
      }
    }

    setGroups((current) =>
      current.map((group) =>
        group.id === activeEditGroup.id
          ? {
            ...group,
            name,
            location_label: values.diningArea?.label ?? null,
            location_lat: values.diningArea?.lat ?? null,
            location_lng: values.diningArea?.lng ?? null,
            location_place_id: values.diningArea?.placeId ?? null,
          }
          : group
      )
    );
    setMembersByGroup((current) => ({
      ...current,
      [activeEditGroup.id]: (current[activeEditGroup.id] ?? []).filter(
        (member) => !values.removedMemberUserIds.includes(member.user_id)
      ),
    }));

    setSaving(false);
    setModalState(null);
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading…</main>;
  }

  return (
    <main
      style={{
        background: "#f9fafb",
        minHeight: "calc(100vh - 65px)",
        padding: 12,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              color="#9ca3af"
              style={{ position: "absolute", left: 14, top: 12 }}
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search groups and members..."
              style={{
                width: "100%",
                height: 40,
                borderRadius: 999,
                border: "2px solid #1d4ed8",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
                padding: "0 16px 0 40px",
                fontSize: 16,
                color: "#717182",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setProfileModalOpen(true);
            }}
            aria-label="Open profile"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "2px solid #1d4ed8",
              background: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1d4ed8",
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            <CircleUserRound size={18} />
          </button>
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

        {notice ? (
          <div
            style={{
              borderRadius: 10,
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: "18px",
            }}
          >
            {notice}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredGroups.map((group) => (
            <GroupOverviewCard
              key={group.id}
              groupName={group.name}
              memberCount={(membersByGroup[group.id] ?? []).length}
              members={membersByGroup[group.id] ?? []}
              ownerUserId={group.owner_id}
              currentUserId={userId}
              hasOpenInvite={Boolean(group.invite_token)}
              onInvite={() => void openGroupInvite(group)}
              onEdit={() => {
                setError(null);
                setNotice(null);
                setModalState({ mode: "edit", groupId: group.id });
              }}
              onRevokeInvite={() => {
                void handleRevokeInvite(group.id);
              }}
            />
          ))}

          {filteredGroups.length === 0 ? (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "white",
                padding: "20px 16px",
                color: "#6a7282",
                fontSize: 14,
                lineHeight: "20px",
                textAlign: "center",
              }}
            >
              {groups.length === 0
                ? "No groups yet. Create your first group to get started."
                : "No groups or members match your search."}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setModalState({ mode: "create" });
            }}
            style={{
              minHeight: 48,
              borderRadius: 10,
              border: "2px dashed #d1d5dc",
              background: "#fafafa",
              color: "#4a5565",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 14,
              lineHeight: "20px",
              fontWeight: 500,
              letterSpacing: "-0.15px",
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            <span>Add group</span>
          </button>
        </div>
      </div>

      {modalState?.mode === "create" ? (
        <CreateEditGroupModal
          mode="create"
          groupName=""
          members={[]}
          currentUserId={userId}
          saving={saving}
          error={error}
          onClose={() => setModalState(null)}
          onSave={handleCreateGroup}
          onPlaceholderAction={setNotice}
        />
      ) : null}

      {modalState?.mode === "edit" && activeEditGroup ? (
        <CreateEditGroupModal
          mode="edit"
          groupName={activeEditGroup.name}
          members={membersByGroup[activeEditGroup.id] ?? []}
          ownerUserId={activeEditGroup.owner_id}
          currentUserId={userId}
          initialDiningArea={
            activeEditGroup.location_label &&
            activeEditGroup.location_lat != null &&
            activeEditGroup.location_lng != null &&
            activeEditGroup.location_place_id
              ? {
                label: activeEditGroup.location_label,
                lat: activeEditGroup.location_lat,
                lng: activeEditGroup.location_lng,
                placeId: activeEditGroup.location_place_id,
                types: [],
                formattedAddress: activeEditGroup.location_label,
              }
              : null
          }
          saving={saving}
          error={error}
          onClose={() => setModalState(null)}
          onSave={handleEditGroup}
          onInviteMember={() => {
            setModalState(null);
            void openGroupInvite(activeEditGroup);
          }}
          onPlaceholderAction={setNotice}
        />
      ) : null}

      {inviteModalState ? (
        <GroupInviteModal
          groupName={inviteModalState.groupName}
          inviteUrl={inviteModalState.inviteUrl}
          onClose={() => setInviteModalState(null)}
        />
      ) : null}

      {pendingInviteRevoke ? (
        <RevokeInviteToast
          groupName={pendingInviteRevoke.groupName}
          onUndo={() => void handleUndoRevokeInvite()}
        />
      ) : null}

      <UserProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSaved={setNotice}
      />
    </main>
  );
}
