"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useRouteFade } from "./use-route-fade";

/**
 * The public site's `<main>`, fading and rising in on every navigation — and on
 * arrival from another part of the app. The header and footer around it stay
 * still, which is what makes it read as a change of page rather than a reload.
 *
 * It may rise where the dashboard's `<main>` may not: the document scrolls
 * here, not `<main>`, and nothing inside it is `position: fixed`.
 */
export function MarketingMain({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useRouteFade(ref, usePathname(), { rise: true });

  return (
    <main ref={ref} className="flex flex-1 flex-col">
      {children}
    </main>
  );
}
