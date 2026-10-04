"use client";

import { useSyncExternalStore } from "react";

/**
 * How long until "Send a new link" may be pressed again, per address.
 *
 * In `localStorage` so a reload does not hand the button back early — the server
 * refuses a second link inside a minute either way (`authEmailCooldown`, and the
 * durable `lib/auth/verify-throttle.ts`), and a live button that can only fail
 * is an invitation to press it. A per-viewer convenience, so storage that
 * throws (a private window, blocked site data) falls back to memory and the
 * server stays the guarantee.
 *
 * One shared one-second ticker for every subscriber, started with the first and
 * stopped with the last. The snapshot is computed from `tick`, not `Date.now()`,
 * so two reads between ticks agree — which `useSyncExternalStore` requires.
 */

const PREFIX = "resend-link-until:";

const memory = new Map<string, number>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let tick = Date.now();

function keyOf(email: string): string {
  return PREFIX + email.trim().toLowerCase();
}

function readUntil(email: string): number {
  const key = keyOf(email);

  try {
    const stored = Number(window.localStorage.getItem(key));
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // Storage unavailable: memory below is the answer.
  }

  return memory.get(key) ?? 0;
}

function emit(): void {
  tick = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  tick = Date.now();
  timer ??= setInterval(emit, 1000);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Hold the button for `ms` from now. */
export function startResendCooldown(email: string, ms: number): void {
  const key = keyOf(email);
  const until = Date.now() + Math.max(0, ms);

  memory.set(key, until);

  try {
    window.localStorage.setItem(key, String(until));
  } catch {
    // Memory holds it for this page's life, which is what is left to offer.
  }

  emit();
}

/** Whole seconds left before another link may be asked for; 0 when it may. */
export function useResendCooldown(email: string): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.max(0, Math.ceil((readUntil(email) - tick) / 1000)),
    // The server has no clock for this viewer: the button renders live, and the
    // stored cooldown takes over on hydration.
    () => 0,
  );
}

/** `0:42`, `14:59`. */
export function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
