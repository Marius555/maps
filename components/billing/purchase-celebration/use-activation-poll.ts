"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVERY_MS = 2_000;
const GIVE_UP_AFTER = 15;

/**
 * Re-asks the server whether a paid plan has landed, for half a minute.
 *
 * A payment produces two independent arrivals — the buyer's browser, sent back
 * by the provider, and the webhook that actually grants the plan — and nothing
 * orders them. `router.refresh()` re-runs the server components on screen
 * (the dashboard layout included, which is where the plan is read), so the plan
 * appears by itself the moment the webhook lands, with no reload.
 *
 * Free at the provider: while activating there is no subscription id yet, so
 * each pass is Appwrite reads only. The caller stops it by passing
 * `active: false` (or by unmounting) once the plan is there.
 *
 * Returns whether it is still waiting; false means it gave up, and the caller
 * says so out loud rather than spinning forever.
 */
export function useActivationPoll(active: boolean): { waiting: boolean } {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  const waiting = tries < GIVE_UP_AFTER;

  useEffect(() => {
    if (!active || !waiting) return;

    const timer = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, EVERY_MS);

    return () => clearTimeout(timer);
    // `tries` drives the next pass: each refresh schedules the one after it.
  }, [active, tries, waiting, router]);

  return { waiting };
}
