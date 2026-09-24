"use client";

import { useLayoutEffect } from "react";

import {
  applyTheme,
  readThemeChoice,
  resolveTheme,
  subscribeThemeChoice,
} from "@/lib/theme/theme-choice";

/**
 * Keeps `<html>` wearing the theme that storage says it should.
 *
 * Two jobs, and both are here because this is mounted on every page:
 *
 * 1. **Puts the theme back if React ever clears it.** The pre-paint script
 *    (`theme-script.tsx`) stamps the class once, while the browser parses
 *    `<head>`, and never runs again. React clears a singleton's attributes when
 *    it tears down a preamble contribution — a Strict Mode remount is the
 *    everyday case, and Next documents it — then re-applies only what it owns
 *    from JSX. Everything the script wrote is simply gone, and `usePrefersDark`
 *    is left reading a `<html>` with no theme on it. A layout effect runs before
 *    the next paint, so the gap is never seen.
 * 2. **Follows the OS while the choice is "System", and follows other tabs.** This
 *    used to happen as a side effect of the account menu holding HeroUI's
 *    `useTheme`, the only always-mounted copy of it. The theme picker moved to
 *    the Settings page, so that job had to move somewhere that is always there.
 *
 * Deliberately stateless: every event re-reads storage (`lib/theme/theme-choice.ts`)
 * rather than remembering a value, so a choice made anywhere — this tab's picker,
 * another tab, a cleared storage — can never leave it holding a stale one.
 *
 * Its own component rather than an effect in `AppProviders`, for the same reason
 * `ToastRegion` is: nothing here should be able to re-render `{children}`.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const sync = () => {
      try {
        applyTheme(resolveTheme(readThemeChoice()));
      } catch {
        // Same reasoning as the script's try/catch: a broken theme must not
        // break the page.
      }
    };

    sync();

    return subscribeThemeChoice(sync);
  }, []);

  return null;
}
