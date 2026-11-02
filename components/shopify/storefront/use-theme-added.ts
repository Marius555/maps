"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this map's step 2 — the Pinglide block added to the theme — has been
 * done, as far as this browser knows (`storefrontSteps`).
 *
 * **Remembered here because nothing else can know it.** Telling whether the
 * block is in the theme needs `read_themes`, which the app does not ask for, and
 * Add to theme leaves the app the moment it is pressed. So the press itself —
 * or the merchant's own "Already added" — is what is recorded.
 *
 * `localStorage`, per map, as a per-viewer convenience (CLAUDE.md, browser
 * storage): losing it shows step 2 again, and Publish stays on screen in every
 * state, so nothing ever waits on it. Every access is wrapped, because a
 * blocked or partitioned store inside the Shopify admin's iframe must read as
 * "not yet", never throw.
 */

const PREFIX = "pinglide:theme-added:";
const CHANGE_EVENT = "pinglide:theme-added";

function read(mapId: string): boolean {
  try {
    return localStorage.getItem(PREFIX + mapId) === "1";
  } catch {
    return false;
  }
}

export function markThemeAdded(mapId: string): void {
  try {
    localStorage.setItem(PREFIX + mapId, "1");
  } catch {
    // Unwritable storage: step 2 shows again next visit, which is all it costs.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) onChange();
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** False on the server and during hydration, so the first paint matches it. */
export function useThemeAdded(mapId: string): boolean {
  return useSyncExternalStore(subscribe, () => read(mapId), () => false);
}
