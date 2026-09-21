"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthUser } from "@/lib/auth/types";
import type {
  ForgotPasswordInput,
  LoginInput,
  OAuthSessionInput,
  ResetPasswordInput,
  SignupInput,
} from "@/lib/validation/auth.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * Who is signed in, and — the part everything else hangs off — whether they have
 * confirmed their address.
 *
 * **The two option overrides are load-bearing and were a real bug.** The global
 * defaults are `staleTime: 30_000` and `refetchOnWindowFocus: false`
 * (`lib/query/client.ts`), and with them this query never notices a confirmation
 * that happened somewhere else. That is the ordinary way out of the email gate:
 * the link opens in a new tab, and the tab the user came from is the frozen
 * dashboard they go back to. Left on the defaults it stays frozen — banner up,
 * Create map dead — until something remounts, which reads exactly like the
 * confirmation not having worked.
 *
 * So this one query asks again every time the window regains focus, and treats
 * what it has as stale so the refetch actually fires. It is one small request
 * against the single most confusing failure this feature has.
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<{ user: AuthUser }>("/api/auth/me"),
    refetchOnWindowFocus: true,
    staleTime: 0,
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

/**
 * Trades the `userId` + `secret` Appwrite left in the callback URL for our own
 * session cookie.
 *
 * The exchange has to be a request to our origin rather than a call to the Web
 * SDK: only our server can set the httpOnly cookie the rest of the app reads.
 * See `createOAuthSession`.
 *
 * **A plain function, not a `useMutation` hook, and this was a real bug found in
 * the browser rather than a preference.** Every other mutation here is fired by
 * a person pressing a button; this one fires once from an effect on mount, and
 * that combination breaks a mutation observer. React's StrictMode mounts the
 * component, tears it down and remounts it — TanStack disposes the first
 * observer along with the first mount, so the in-flight request settles against
 * an observer nobody is subscribed to and the remounted component sits at
 * `isIdle` forever. Observed exactly that way: the POST returned 401, the
 * console showed it, and the page stayed on "Signing you in" indefinitely with
 * no error ever rendering.
 *
 * A promise has no such lifecycle, so `OAuthCallback` awaits this and keeps the
 * outcome in its own state. It seeds `queryKeys.me` itself for the same reason —
 * an `onSuccess` passed to a disposed observer is not guaranteed to run.
 *
 * There is no retry, deliberately: a token is single-use, so a second attempt
 * can only fail, and it would replace an honest "this link is spent" with a
 * second more confusing error.
 */
export async function exchangeOAuthToken(
  input: OAuthSessionInput,
): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/api/auth/oauth/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiFetch<void>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      apiFetch<{ user: AuthUser }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: ({ user }) => queryClient.setQueryData(queryKeys.me, { user }),
    retry: false,
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      apiFetch<void>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(input),
      }),
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
