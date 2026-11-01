"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { readThemeChoice, resolveTheme } from "@/lib/theme/theme-choice";
import { loadTurnstile } from "./load-script";

/**
 * A Cloudflare Turnstile widget for one form, and the token it earns.
 *
 * **Invisible unless Cloudflare wants a click** (`appearance: "interaction-only"`
 * on a managed widget): almost everybody presses the button without ever seeing
 * it, and the few who look automated get a checkbox in the slot above it.
 *
 * **A press while that checkbox waits is answered on the form**, not sent. With
 * no token the server can only refuse, after a ten-second wait, with a message
 * that says to reload — which helps nobody looking at an unticked box. So
 * `getToken` answers `needs-click` at once, and `tickPrompt` turns on the line
 * under the checkbox saying what to do; it goes again when the token arrives.
 *
 * **A token is single-use and lasts five minutes.** `refresh-expired: "auto"`
 * renews it while the person is still typing, and `reset()` must run after every
 * failed submit — the server spends the token whether or not the rest of the
 * request succeeds, so a second press with the old one is refused.
 *
 * With no site key configured (a clone, a self-hosted install) nothing renders
 * and `getToken` answers a null token at once; the server's check is off in
 * exactly that case (`lib/turnstile/human-check.ts`), so the two halves agree.
 */

/** What a press gets: a token to send, or a checkbox still to tick. */
export type HumanCheck =
  | {
      status: "ready";
      /** Null when none came in time; the server's refusal then says what to do. */
      token: string | null;
    }
  | { status: "needs-click" };

/**
 * How long a press waits for a token that has not arrived yet. Long enough for
 * a slow first challenge; past it the request goes without one and the server's
 * refusal says what to do.
 */
const TOKEN_WAIT_MS = 10_000;

/** Below this the "flexible" widget (300px minimum) would overflow the column. */
const FLEXIBLE_MIN_WIDTH = 300;

type Waiter = (check: HumanCheck) => void;

/** Answer every press still waiting, emptying the queue first. */
function release(waiting: RefObject<Waiter[]>, check: HumanCheck) {
  const waiters = waiting.current;
  waiting.current = [];
  for (const settle of waiters) settle(check);
}

export function useTurnstile(action: string) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  /** The checkbox is on screen and unticked. */
  const interactive = useRef(false);
  const waiting = useRef<Waiter[]>([]);
  const [tickPrompt, setTickPrompt] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!siteKey || !container) return;

    let cancelled = false;
    let rendered: string | undefined;

    loadTurnstile()
      .then((api) => {
        if (cancelled) return;

        rendered = api.render(container, {
          sitekey: siteKey,
          action,
          // Read once rather than followed: re-rendering the widget on a theme
          // change would throw away a token the person has already earned.
          theme: resolveTheme(readThemeChoice()),
          size: container.clientWidth < FLEXIBLE_MIN_WIDTH ? "compact" : "flexible",
          appearance: "interaction-only",
          "refresh-expired": "auto",
          callback: (earned) => {
            token.current = earned;
            interactive.current = false;
            setTickPrompt(false);
            release(waiting, { status: "ready", token: earned });
          },
          "before-interactive-callback": () => {
            interactive.current = true;
            // Somebody pressed before Cloudflare decided it wanted a click:
            // tell them now rather than when the wait runs out.
            if (waiting.current.length > 0) setTickPrompt(true);
            release(waiting, { status: "needs-click" });
          },
          "after-interactive-callback": () => {
            interactive.current = false;
          },
          "expired-callback": () => {
            token.current = null;
          },
          "error-callback": () => {
            // Turnstile retries by itself; a press waiting meanwhile times out
            // into the server's refusal, which says what to do.
            token.current = null;
          },
        });
        widgetId.current = rendered ?? null;
      })
      .catch((error: unknown) => {
        // Blocked or offline. The press still goes, without a token, and the
        // server's message ("reload the page") is the way out.
        console.error(error);
      });

    return () => {
      cancelled = true;
      if (rendered) window.turnstile?.remove(rendered);
      widgetId.current = null;
      token.current = null;
      interactive.current = false;
    };
  }, [siteKey, action]);

  /** The current token, waiting briefly for one still being earned. */
  const getToken = useCallback((): Promise<HumanCheck> => {
    if (!siteKey) return Promise.resolve({ status: "ready", token: null });
    if (token.current) return Promise.resolve({ status: "ready", token: token.current });

    if (interactive.current) {
      setTickPrompt(true);
      return Promise.resolve({ status: "needs-click" });
    }

    return new Promise((resolve) => {
      const settle: Waiter = (check) => {
        clearTimeout(timer);
        waiting.current = waiting.current.filter((entry) => entry !== settle);
        resolve(check);
      };
      const timer = setTimeout(() => settle({ status: "ready", token: null }), TOKEN_WAIT_MS);
      waiting.current.push(settle);
    });
  }, [siteKey]);

  /** Spend the old token and earn a new one — after any failed submit. */
  const reset = useCallback(() => {
    token.current = null;
    interactive.current = false;
    setTickPrompt(false);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  return { containerRef, getToken, reset, tickPrompt };
}
