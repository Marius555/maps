"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { IconButton } from "@/components/ui/icon-button";

/** The two front doors. Every other auth screen is a step off `/login`. */
const HOME_FROM = new Set(["/login", "/signup"]);

/**
 * Back out of an auth screen, to a destination this file decides.
 *
 * **It never calls `router.back()`, and that is the whole point.** The entry
 * behind an auth page is very often a dashboard page the visitor is no longer
 * allowed to see: signing out replaces only the page you were on, so `/maps` and
 * every map opened before it are still sitting in the history stack. Going back
 * to one is a history restore, which makes no request — so `proxy.ts`, the
 * dashboard layout's `getCurrentUser()` and `requireUser()` all sit it out, the
 * stale dashboard paints, and the first thing to actually reach the server is a
 * map card's preview fetch answering 401 into the console.
 *
 * So there are two destinations and no browser history involved:
 *
 * - **Log in and Sign up go home.** They are the front door; behind them is
 *   either the landing page or a dashboard that is now off limits.
 * - **Everything else goes to `/login`.** Forgot, reset, confirm and the two
 *   OAuth result screens are all steps off the login page or arrivals from an
 *   email, and the login form is where each of them is heading anyway.
 *
 * `push` rather than `replace`, so the browser's own Back still undoes the press.
 */
export function AuthBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <IconButton
      label="Go back"
      icon={ArrowLeft}
      variant="ghost"
      size="md"
      placement="right"
      onPress={() => {
        router.push(HOME_FROM.has(pathname) ? "/" : "/login");
      }}
    />
  );
}
