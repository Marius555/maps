"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useRouteFade } from "./use-route-fade";

/**
 * The settings column beside the section list, fading in when the section
 * changes. The shell's own fade treats every settings section as one page
 * (`shellRouteKey`), so this is the only thing that moves between them and the
 * nav the person just pressed stays exactly where it is.
 */
export function SettingsPane({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Not on mount: arriving at Settings from another page, `PageMain` fades
  // already, and two fades at once multiply into one darker dip.
  useRouteFade(ref, pathname, { onMount: false });

  return (
    <div ref={ref} className="min-w-0 max-w-6xl flex-1">
      {children}
    </div>
  );
}
