"use client";

import { useSyncExternalStore } from "react";

/**
 * Is the dashboard currently dark?
 *
 * Read off `<html>` rather than from `useTheme()`. HeroUI's hook exposes
 * `resolvedTheme`, but it is `undefined` on the first client render — and things
 * that need the answer *at mount*, like the basemap a MapLibre instance is
 * constructed with, would take the light branch and then correct themselves a
 * tick later. That is a visible flash on every page load.
 *
 * The class is already correct before first paint: the blocking script in
 * components/providers/theme-script.tsx stamps it in `<head>`, ahead of `<body>`
 * existing. So the DOM is both the earliest and the most reliable source, and
 * `ThemeSync` puts it back if React ever clears `<html>`.
 *
 * Watching the class attribute rather than `matchMedia` is deliberate too — it
 * catches an explicit light/dark choice *and* the "system" setting following the
 * OS, because HeroUI's `setTheme` resolves both down to this one class.
 */

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** No document on the server, and guessing dark would flash light-to-dark. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
