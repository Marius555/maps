"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { MemberRole, WorkspaceRole } from "@/lib/team/roles";
import type { Invite, Membership, WorkspaceSummary } from "@/lib/team/types";
import type { InviteInput } from "@/lib/validation/team.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * Settings → Team's writes, and switching between teams.
 *
 * **Each team write ends in `router.refresh()`**, for the reason the other
 * settings hooks give (lib/query/account.ts): the Team page is a server
 * component, and a refresh re-reads it after the route has written.
 *
 * **Switching, joining and leaving end in a document navigation instead.** A
 * different workspace is a different set of maps, card design and plan, held in
 * three places on the client — the router cache, react-query and the editor's
 * zustand stores. A full load clears all three in one go, which is what logout
 * does for the same reason.
 */

type InviteAnswer = { invite: Invite; inviteUrl: string };

/**
 * `replace`, not `assign`: Back from the new team's maps should not land on a
 * page rendered for the old one, which is all the router cache would offer.
 */
function home(): void {
  window.location.replace("/maps");
}

export function useSwitchWorkspace() {
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiFetch<{ workspaceId: string }>("/api/workspaces/active", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      }),
    onSuccess: home,
  });
}

export function useLeaveWorkspace() {
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiFetch<void>(`/api/workspaces/${encodeURIComponent(workspaceId)}/membership`, {
        method: "DELETE",
      }),
    onSuccess: home,
  });
}

export function useInvite() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: InviteInput) =>
      apiFetch<InviteAnswer>("/api/team/invites", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => router.refresh(),
  });
}

export function useResendInvite() {
  const router = useRouter();

  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<InviteAnswer>(`/api/team/invites/${encodeURIComponent(inviteId)}`, {
        method: "POST",
      }),
    onSuccess: () => router.refresh(),
  });
}

export function useRevokeInvite() {
  const router = useRouter();

  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<void>(`/api/team/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => router.refresh(),
  });
}

export function useChangeRole() {
  const router = useRouter();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      apiFetch<{ membership: Membership }>(`/api/team/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveMember() {
  const router = useRouter();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/api/team/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => router.refresh(),
  });
}

/** Join from an invite link. Lands in the team, by a full load. */
export function useAcceptInviteLink() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ workspaceId: string }>(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      }),
    onSuccess: home,
  });
}

export function useDeclineInviteLink() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<void>(`/api/invites/${encodeURIComponent(token)}`, { method: "DELETE" }),
  });
}

/** Join from the "Invitations for you" list. */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<{ workspaceId: string }>(
        `/api/invites/mine/${encodeURIComponent(inviteId)}/accept`,
        { method: "POST" },
      ),
    onSuccess: home,
  });
}

export function useDeclineInvitation() {
  const router = useRouter();

  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<void>(`/api/invites/mine/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => router.refresh(),
  });
}

type WorkspacesAnswer = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  role: WorkspaceRole;
};

/** The person's workspaces and the switched-to one — for pages outside the dashboard. */
export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"] as const,
    queryFn: () => apiFetch<WorkspacesAnswer>("/api/workspaces"),
  });
}

/**
 * Switch teams without leaving the page — for /connect/wordpress, which holds
 * no editor state and only needs its map list read again. The dashboard uses
 * `useSwitchWorkspace`, which reloads.
 */
export function useSwitchWorkspaceInPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiFetch<{ workspaceId: string }>("/api/workspaces/active", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.maps.list() }),
      ]);
    },
  });
}
