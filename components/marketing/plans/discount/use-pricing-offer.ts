"use client";

import { useCallback, useEffect, useState } from "react";

import type { PricingOffer, PublicDiscount } from "@/lib/billing/types";
import { ApiError, apiFetch } from "@/lib/query/fetcher";

/**
 * The server's last answer, remembered for this tab. A reload within
 * `FRESH_MS` asks nobody: `/api/pricing/offer` is rate-limited per address, and
 * a visitor reloading the page was spending that budget until the check failed
 * and the page said so.
 */
const STORAGE_KEY = "pricing-offer";

/** How long a remembered answer is used without asking again. */
const FRESH_MS = 5 * 60_000;

/**
 * How long the cards wait for an answer before showing undiscounted. They are
 * hidden until then (`.pricing-pending`), so a slow provider must not hold them.
 */
const SETTLE_MS = 1500;

const UNCHECKED = "Couldn't check that code right now. You can still enter it at the checkout.";

type Remembered = { offer: PricingOffer; at: number };

function readRemembered(): Remembered | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Remembered) : null;

    return parsed && typeof parsed.at === "number" && parsed.offer ? parsed : null;
  } catch {
    return null;
  }
}

/** Only an answer worth replaying: no error, which belonged to the moment it was given. */
function remember(offer: PricingOffer): void {
  try {
    const kept: Remembered = {
      offer: { featured: offer.featured, code: offer.code, codeError: null },
      at: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Storage refused (a private window, blocked site data): the answer just
    // isn't remembered past this page.
  }
}

/**
 * One request per code at a time. React's development double-run mounts the
 * effect twice, and each run used to send its own request — two spent from the
 * rate limit per page load.
 */
let inflight: { key: string; promise: Promise<PricingOffer> } | null = null;

function requestOffer(code: string | null): Promise<PricingOffer> {
  const key = code ?? "";
  if (inflight?.key === key) return inflight.promise;

  const promise = apiFetch<PricingOffer>(
    `/api/pricing/offer${code ? `?${new URLSearchParams({ code }).toString()}` : ""}`,
  );
  inflight = { key, promise };

  void promise
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    })
    .catch(() => undefined);

  return promise;
}

export type PricingDiscount = {
  /** What the cards apply: the visitor's code if it is live, else the featured promo. */
  applied: PublicDiscount | null;
  /** Why the code the visitor typed, or arrived with, isn't applied. */
  error: string | null;
  checking: boolean;
  /**
   * True once the cards may be drawn: an answer is in hand, the check failed,
   * or `SETTLE_MS` passed. Until then they are hidden, so they paint once with
   * the right prices rather than changing under the visitor.
   */
  settled: boolean;
  /** Resolves to the discount when the code was applied, null when it was not. */
  apply: (code: string) => Promise<PublicDiscount | null>;
};

/**
 * The discount the pricing page shows, asked for after the page arrives so the
 * page itself stays statically rendered (docs/notes/billing.md, "Discounts").
 *
 * A code comes from the link (`?code=`, read here rather than through
 * `useSearchParams`, which would need a Suspense boundary around the grid) or
 * from the tab's remembered answer. Every answer is the server's: the client
 * never decides what a code is worth.
 *
 * **Errors are shown only to somebody who asked.** A code typed now, or one in
 * the link they followed, says why it was refused. A code remembered from
 * earlier in the tab is re-checked silently: refused, it is dropped; unchecked
 * (a rate limit, the provider down), the last answer stands.
 */
export function usePricingOffer(): PricingDiscount {
  const [offer, setOffer] = useState<PricingOffer | null>(null);
  const [checking, setChecking] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() || null;
    const remembered = readRemembered();
    const asked = fromLink ?? remembered?.offer.code?.code ?? null;
    const usable = remembered && (remembered.offer.code?.code ?? null) === asked ? remembered : null;

    if (usable) {
      setOffer(usable.offer);
      setSettled(true);
      if (Date.now() - usable.at < FRESH_MS) return;
    }

    let current = true;
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);

    requestOffer(asked)
      .then((next) => {
        if (!current) return;

        if (next.codeUnchecked) {
          // No news about the code: keep the answer already showing, if any.
          if (!usable) setOffer({ featured: next.featured, code: null, codeError: null });
          return;
        }

        remember(next);
        setOffer(fromLink ? next : { ...next, codeError: null });
      })
      .catch(() => {
        // Rate-limited or offline: whatever was showing stands, and the code
        // box at the checkout still works.
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (current) setSettled(true);
      });

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, []);

  const apply = useCallback(async (code: string): Promise<PublicDiscount | null> => {
    setChecking(true);

    try {
      const next = await requestOffer(code);

      if (next.code) {
        remember(next);
        setOffer({ featured: next.featured, code: next.code, codeError: null });
        return next.code;
      }

      // A refused code does not take away a discount already applied.
      setOffer((current) => ({
        featured: next.featured ?? current?.featured ?? null,
        code: current?.code ?? null,
        codeError: next.codeError,
      }));
      return null;
    } catch (error) {
      setOffer((current) => ({
        featured: current?.featured ?? null,
        code: current?.code ?? null,
        codeError: error instanceof ApiError ? error.message : UNCHECKED,
      }));
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    applied: offer?.code ?? offer?.featured ?? null,
    error: offer?.codeError ?? null,
    checking,
    settled,
    apply,
  };
}
