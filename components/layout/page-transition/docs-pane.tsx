"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useRouteFade } from "./use-route-fade";

/**
 * The guide beside the docs nav, fading in when the guide changes. The public
 * site's own fade treats every guide as one page (`marketingRouteKey`), so this
 * is the only thing that moves between them and the nav stays exactly where it
 * is.
 *
 * Opacity only. The 8px rise is for a change of page; here it made a long
 * article lurch under a rail that held still.
 */
export function DocsPane({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Not on mount: arriving at the docs from another page, `MarketingMain`
  // fades already, and two fades at once multiply into one darker dip.
  useRouteFade(ref, pathname, { onMount: false });

  return (
    <div ref={ref} className="flex min-w-0 flex-1">
      {children}
    </div>
  );
}
