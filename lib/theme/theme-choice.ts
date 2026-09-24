"use client";

import { useSyncExternalStore } from "react";

/**
 * The dashboard's colour mode: what was chosen, and what it resolves to.
 *
 * **One store, instead of HeroUI's `useTheme`.** That hook keeps the stored
 * choice in `useState`, one copy per call site, read once at mount. It worked
 * while it had exactly one always-mounted caller — the account menu in the
 * sidebar footer — and that caller was also, invisibly, the only thing on screen
 * following a live OS light/dark switch while the choice was "System". Moving the
 * picker to a settings page would have taken that away from every other page. It
 * also reads localStorage inside its `useState` initialiser, so a picker that is
 * server-rendered hydrates against a value the server never had.
 *
 * So the choice lives in localStorage and nowhere else, every reader asks storage
 * afresh, and a write tells everybody. `ThemeSync` (always mounted) re-applies it
 * on OS changes and on writes from other tabs; the settings picker reads it
 * through `useThemeChoice`. Nothing can hold a stale copy because nothing holds a
 * copy.
 *
 * **The key is `heroui-theme` and must stay so.** The pre-paint script in
 * `components/providers/theme-script.tsx` reads it before React exists, and every
 * browser that has ever chosen a theme on this app has it stored under that name.
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "system", "dark"];

const STORAGE_KEY = "heroui-theme";
const PREFERS_DARK = "(prefers-color-scheme: dark)";
/** Same-tab writes. `storage` only fires in the *other* tabs. */
const CHANGE_EVENT = "app:theme-choice";

function isChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * What is stored, as one of the three choices.
 *
 * "system" when nothing is stored, when storage throws (some privacy modes throw
 * on access outright), and when the stored value is not one we know — which is
 * the same fallback the pre-paint script takes, so the two can never disagree
 * about an unreadable value.
 */
export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") return choice;

  return window.matchMedia(PREFERS_DARK).matches ? "dark" : "light";
}

/**
 * Stamps the resolved theme on `<html>`: the class *and* `data-theme`, because
 * globals.css keys off both. A no-op when it is already there, so it never fires
 * the MutationObserver `usePrefersDark` watches for nothing — every map on the
 * page listens to that.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  const applied = root.dataset.theme;

  if (applied === resolved && root.classList.contains(resolved)) return;
  if (applied && applied !== resolved) root.classList.remove(applied);

  root.classList.add(resolved);
  root.dataset.theme = resolved;
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Unwritable storage still gets this page repainted; it just won't be
    // remembered, which is the most a browser in that mode allows anyway.
  }

  applyTheme(resolveTheme(choice));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Calls back whenever the *effective* theme may have changed: a choice made in
 * this tab, a choice made in another, or the OS flipping while "System" is on.
 */
export function subscribeThemeChoice(onChange: () => void): () => void {
  const media = window.matchMedia(PREFERS_DARK);
  const onStorage = (event: StorageEvent) => {
    // `key` is null when storage was cleared wholesale, which is a change too.
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onChange);
  };
}

/**
 * The stored choice, or null on the server and during hydration.
 *
 * Null rather than a guess, so a server-rendered picker draws *nothing* selected
 * and then the right thing, instead of the wrong thing and then the right thing —
 * and so it never hydrates against a value the server could not have known.
 */
export function useThemeChoice(): ThemeChoice | null {
  return useSyncExternalStore<ThemeChoice | null>(
    subscribeThemeChoice,
    readThemeChoice,
    () => null,
  );
}
