"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useRouteFade } from "./use-route-fade";

/**
 * The operator console's `<main>`, fading in between its pages.
 *
 * Opacity only, like the dashboard's `PageMain` and for its reason: this
 * `<main>` is the console's one scroller, and a transform on it would make it
 * the containing block of every `position: fixed` descendant while it plays.
 */
export function AdminMain({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useRouteFade(ref, usePathname());

  return (
    <main
      ref={ref}
      className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
    >
      {children}
    </main>
  );
}
