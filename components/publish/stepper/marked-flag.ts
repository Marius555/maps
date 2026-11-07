"use client";

import { useSyncExternalStore } from "react";

/**
 * A per-map "this step is done", as far as this browser knows — for the
 * stepper steps nothing else can tell us about:
 *
 * - `pinglide:theme-added:` — the Pinglide block is in the Shopify theme
 *   (`StorefrontStepper`). Knowing for sure needs `read_themes`, which the app
 *   does not ask for, and Add to theme leaves the app the moment it is pressed.
 * - `pinglide:embed-added:` — the snippet is on the owner's site
 *   (`WebsiteStepper`). Nothing can know that; a successful Copy embed code is
 *   the closest thing to it.
 *
 * So the press itself — or the owner's own "Already added" — is what is
 * recorded. **Keep the prefixes as they are**: the theme one was written by
 * merchants' browsers before this file was shared, and renaming it would show
 * them the step again.
 *
 * `localStorage`, per map, as a per-viewer convenience (CLAUDE.md, browser
 * storage): losing it shows the step again, and the step's button is on screen
 * whenever it is, so nothing ever waits on it. Every access is wrapped, because
 * a blocked or partitioned store inside the Shopify admin's iframe must read as
 * "not yet", never throw.
 */
export function markedFlag(prefix: string): {
  mark: (mapId: string) => void;
  useMarked: (mapId: string) => boolean | undefined;
} {
  const changeEvent = `${prefix}changed`;

  const read = (mapId: string): boolean => {
    try {
      return localStorage.getItem(prefix + mapId) === "1";
    } catch {
      return false;
    }
  };

  const mark = (mapId: string): void => {
    try {
      localStorage.setItem(prefix + mapId, "1");
    } catch {
      // Unwritable storage: the step shows again next visit, which is all it costs.
    }
    window.dispatchEvent(new Event(changeEvent));
  };

  const subscribe = (onChange: () => void): (() => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(prefix)) onChange();
    };

    window.addEventListener(changeEvent, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(changeEvent, onChange);
      window.removeEventListener("storage", onStorage);
    };
  };

  /**
   * `undefined` on the server and during hydration — "not read yet", which the
   * steppers draw as loading. It used to be `false` there, so a browser that
   * had marked the step painted it as still to do and then flipped it done a
   * moment after hydration: one of the jumps the owner reported (2026-11-07).
   */
  const useMarked = (mapId: string): boolean | undefined =>
    useSyncExternalStore(subscribe, () => read(mapId), () => undefined);

  return { mark, useMarked };
}

export const themeAdded = markedFlag("pinglide:theme-added:");
export const embedAdded = markedFlag("pinglide:embed-added:");
