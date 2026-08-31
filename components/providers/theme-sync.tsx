"use client";

import { useLayoutEffect } from "react";

/**
 * Puts the theme back on `<html>` if React ever clears it.
 *
 * The pre-paint script (`theme-script.tsx`) stamps the class once, while the
 * browser parses `<head>`, and never runs again. React clears a singleton's
 * attributes when it tears down a preamble contribution — a Strict Mode remount
 * is the everyday case, and Next documents it — then re-applies only what it
 * owns from JSX. Everything the script wrote is simply gone, and `usePrefersDark`
 * is left reading a `<html>` with no theme on it. A layout effect runs before
 * the next paint, so the gap is never seen.
 *
 * Mount-only, and deliberately stateless. HeroUI's `useTheme` would do this and
 * follow the OS as well, but it caches the stored value in state at mount: with
 * the account menu holding a second copy of that hook, a theme picked in the menu
 * would leave this one stale, and the next OS light/dark switch would overwrite
 * the explicit choice. Reading storage at mount cannot disagree with anything.
 *
 * Its own component rather than an effect in `AppProviders`, for the same reason
 * `ToastRegion` is: nothing here should be able to re-render `{children}`.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    let resolved: string;

    try {
      const stored = localStorage.getItem("heroui-theme") || "system";
      resolved =
        stored === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : stored;
    } catch {
      // Same reasoning as the script's try/catch: localStorage throws outright
      // in some privacy modes, and a broken theme must not break the page.
      return;
    }

    const root = document.documentElement;
    const applied = root.dataset.theme;

    if (applied === resolved) return;
    if (applied) root.classList.remove(applied);

    root.classList.add(resolved);
    root.dataset.theme = resolved;
  }, []);

  return null;
}
