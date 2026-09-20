"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser's own origin, or null until mounted.
 *
 * An external value, not React state, so it is read with `useSyncExternalStore`
 * rather than set from an effect. It never changes, hence the no-op subscribe;
 * the server snapshot is null so SSR and the first hydration render agree.
 *
 * Both things the share dialog hands out — the snippet and the test page URL —
 * have to be built from it, so that a self-hosted or preview deployment points at
 * itself. Guessing an origin during SSR would put a wrong URL on somebody's
 * clipboard.
 */
const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => null;

export function useOrigin(): string | null {
  return useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
}
