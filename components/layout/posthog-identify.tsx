"use client";

import { useEffect } from "react";

import type { AuthUser } from "@/lib/auth/types";
import { identifyUser } from "@/lib/posthog/client";

/**
 * Ties this document's PostHog events to the signed-in account. Mounted by the
 * dashboard shell, which persists across client navigations, so it runs once per
 * document load — and has to run on every one, because PostHog keeps its id in
 * memory only (`instrumentation-client.ts`).
 */
export function PostHogIdentify({ user }: { user: AuthUser }) {
  useEffect(() => {
    identifyUser(user);
  }, [user]);

  return null;
}
