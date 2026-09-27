"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useRefreshStaleRoute } from "@/lib/query/server-render-staleness";

import { shellRouteKey } from "./route-key";
import { useRouteFade } from "./use-route-fade";

/**
 * The dashboard's `<main>`, fading in on every navigation.
 *
 * It *is* the element `AppShell` used to render, classes unchanged, rather than
 * a wrapper inside it: `<main>` is the only scroller, `relative` is what keeps
 * the frame one viewport tall, and the editor fills its height as a direct flex
 * child. A wrapper node would have to reproduce all three, and the first one it
 * missed would be a map collapsed to zero height. See `AppShell` for why each
 * class is there.
 *
 * It also owns the one watcher of every dashboard navigation, so the rule that
 * a write refreshes the next page the router replays lives here too
 * (`useRefreshStaleRoute`).
 */
export function PageMain({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useRouteFade(ref, shellRouteKey(pathname));
  useRefreshStaleRoute();

  return (
    <main
      ref={ref}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]"
    >
      {children}
    </main>
  );
}
