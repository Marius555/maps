"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthUser } from "@/lib/auth/types";
import type { LoginInput, SignupInput } from "@/lib/validation/auth.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<{ user: AuthUser }>("/api/auth/me"),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: ({ user }) => queryClient.setQueryData(queryKeys.me, { user }),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignupInput) =>
      apiFetch<{ user: AuthUser }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: ({ user }) => queryClient.setQueryData(queryKeys.me, { user }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>("/api/auth/logout", { method: "POST" }),
    // Wipe every cached query: the next user on this browser must not see the
    // previous one's maps flash on screen.
    onSuccess: () => queryClient.clear(),
  });
}
