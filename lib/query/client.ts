"use client";

import { MutationCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "./fetcher";
import { markServerRenderStale } from "./server-render-staleness";
import { toastEmailUnverified } from "./verify-email-toast";

/**
 * `"use client"` because of the `MutationCache` below: it reaches the toast
 * queue, which only exists in the browser. Nothing server-side imported this
 * anyway — `components/providers/app-providers.tsx` is the only caller.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    /**
     * One cross-cutting failure is handled here rather than per hook: an account
     * that has not confirmed its email address is refused by `withAuth` on every
     * write in the app, so *any* mutation can return it. A per-hook `onError`
     * would cover the hooks someone remembered to touch; this covers the ones
     * that do not exist yet. See `verify-email-toast.ts`.
     *
     * A mutation's own `onError` still runs — this is in addition to it, not
     * instead of it — so inline error rendering is unaffected.
     *
     * `onSuccess` is the other cross-cutting rule: a write may have changed a
     * page the client router is holding, so the next navigation refreshes it.
     * See `server-render-staleness.ts`.
     */
    mutationCache: new MutationCache({
      onError: (error) => {
        toastEmailUnverified(error);
      },
      onSuccess: () => {
        markServerRenderStale();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Retrying a 401 or a plan limit just delays the message the user needs.
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        // Never silently retry a create — a dropped pin would land twice.
        retry: 0,
      },
    },
  });
}
