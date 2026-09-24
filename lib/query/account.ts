"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { AuthUser } from "@/lib/auth/types";
import type { ChangePasswordInput, ProfileInput } from "@/lib/validation/account.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * The settings pages' writes.
 *
 * **Each one ends in `router.refresh()`**, for the reason `useChangePlan` gives:
 * what they change is read by server components, not by a query cache. The
 * name is in the user menu, which the dashboard layout renders from the
 * session; the device list is rendered by the Account page. A refresh re-runs
 * exactly those, after the route has already written, so it cannot read the old
 * value.
 */

export function useUpdateProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch<{ user: AuthUser }>("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.me, { user });
      router.refresh();
    },
  });
}

export function useChangePassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<void>("/api/account/password", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    // The other devices were just signed out, so the list under this form is
    // stale; and a Google-only account now has a password, which changes the
    // form's own heading.
    onSuccess: () => router.refresh(),
  });
}

export function useRevokeSession() {
  const router = useRouter();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<void>(`/api/account/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => router.refresh(),
  });
}

export function useRevokeOtherSessions() {
  const router = useRouter();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ signedOut: number }>("/api/account/sessions", { method: "DELETE" }),
    onSuccess: () => router.refresh(),
  });
}
