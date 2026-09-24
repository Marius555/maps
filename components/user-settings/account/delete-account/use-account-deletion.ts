"use client";

import { useCallback, useRef, useState } from "react";

import { ApiError, apiFetch } from "@/lib/query/fetcher";

/**
 * Drives the deletion: confirm once, then call the step route until it says
 * `done`, then leave.
 *
 * **A loop over plain requests, not a `useMutation`.** It is many requests
 * that make one outcome, and it has to keep going across them; TanStack's model
 * is one request per mutation. The same reason `sheet-sync` drives its steps by
 * hand.
 *
 * **A step that fails is retried**, three times with a growing pause, because
 * the likely failure is the host's time limit or a network blip, and every step
 * is safe to repeat (`runDeletionStep`). After that the dialog says so and
 * offers Try again, which carries on from the next step. The account is still
 * there, and nothing is asked twice.
 *
 * **Leaving is a document navigation**, as logout is. The account no longer
 * exists, and a soft navigation would keep every dashboard page reachable from
 * the router cache on Back.
 */

export type DeletionPhase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "deleting"; total: number; left: number }
  | { kind: "failed"; message: string; confirmed: boolean }
  | { kind: "done" };

type Progress = { done: boolean; mapsLeft: number };

const RETRIES = 3;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function step(): Promise<Progress> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await apiFetch<Progress>("/api/account/deletion/step", { method: "POST" });
    } catch (error) {
      // A 4xx is an answer, not a blip: retrying it would say the same thing.
      const transient = !(error instanceof ApiError) || error.status >= 500;
      if (!transient || attempt >= RETRIES) throw error;

      await pause(1000 * 2 ** attempt);
    }
  }
}

export function useAccountDeletion() {
  const [phase, setPhase] = useState<DeletionPhase>({ kind: "idle" });
  const total = useRef(0);

  const runSteps = useCallback(async () => {
    try {
      for (;;) {
        const progress = await step();

        if (progress.done) {
          setPhase({ kind: "done" });
          window.location.replace("/");
          return;
        }

        total.current = Math.max(total.current, progress.mapsLeft);
        setPhase({ kind: "deleting", total: total.current, left: progress.mapsLeft });
      }
    } catch (error) {
      setPhase({
        kind: "failed",
        confirmed: true,
        message:
          error instanceof ApiError
            ? error.message
            : "The connection dropped partway through. Your account is only partly deleted. Try again to finish.",
      });
    }
  }, []);

  /** Confirm with the typed address, then run. Throws field errors back to the form. */
  const start = useCallback(
    async (email: string) => {
      setPhase({ kind: "starting" });

      let mapsLeft: number;

      try {
        ({ mapsLeft } = await apiFetch<{ mapsLeft: number }>("/api/account/deletion", {
          method: "POST",
          body: JSON.stringify({ email }),
        }));
      } catch (error) {
        setPhase({ kind: "idle" });
        throw error;
      }

      total.current = mapsLeft;
      setPhase({ kind: "deleting", total: mapsLeft, left: mapsLeft });
      await runSteps();
    },
    [runSteps],
  );

  /** After a failure: carry on from the next step, without confirming again. */
  const resume = useCallback(() => {
    setPhase({ kind: "deleting", total: total.current, left: total.current });
    void runSteps();
  }, [runSteps]);

  return { phase, start, resume };
}
