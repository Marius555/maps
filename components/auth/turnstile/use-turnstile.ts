"use client";

import { useCallback, useEffect, useRef } from "react";

import { readThemeChoice, resolveTheme } from "@/lib/theme/theme-choice";
import { loadTurnstile } from "./load-script";

/**
 * A Cloudflare Turnstile widget for one form, and the token it earns.
 *
 * **Invisible unless Cloudflare wants a click** (`appearance: "interaction-only"`
 * on a managed widget): almost everybody presses the button without ever seeing
 * it, and the few who look automated get a checkbox in the slot above it.
 *
 * **A token is single-use and lasts five minutes.** `refresh-expired: "auto"`
 * renews it while the person is still typing, and `reset()` must run after every
 * failed submit — the server spends the token whether or not the rest of the
 * request succeeds, so a second press with the old one is refused.
 *
 * With no site key configured (a clone, a self-hosted install) nothing renders
 * and `getToken` answers null at once; the server's check is off in exactly that
 * case (`lib/turnstile/human-check.ts`), so the two halves agree.
 */

/**
 * How long a press waits for a token that has not arrived yet. Long enough for
 * a slow first challenge; past it the request goes without one and the server's
 * refusal says what to do.
 */
const TOKEN_WAIT_MS = 10_000;

/** Below this the "flexible" widget (300px minimum) would overflow the column. */
const FLEXIBLE_MIN_WIDTH = 300;

export function useTurnstile(action: string) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const waiting = useRef<((token: string) => void)[]>([]);

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
            const resolvers = waiting.current;
            waiting.current = [];
            for (const resolve of resolvers) resolve(earned);
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
    };
  }, [siteKey, action]);

  /** The current token, waiting briefly for one still being earned. */
  const getToken = useCallback((): Promise<string | null> => {
    if (!siteKey) return Promise.resolve(null);
    if (token.current) return Promise.resolve(token.current);

    return new Promise((resolve) => {
      const settle = (value: string | null) => {
        clearTimeout(timer);
        waiting.current = waiting.current.filter((entry) => entry !== settle);
        resolve(value);
      };
      const timer = setTimeout(() => settle(null), TOKEN_WAIT_MS);
      waiting.current.push(settle);
    });
  }, [siteKey]);

  /** Spend the old token and earn a new one — after any failed submit. */
  const reset = useCallback(() => {
    token.current = null;
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  return { containerRef, getToken, reset };
}
