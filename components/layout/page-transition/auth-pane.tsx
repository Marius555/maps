"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useRouteFade } from "./use-route-fade";

/**
 * The form half of the sign-in pages, fading and rising in between login,
 * signup and the rest. The drawn map beside it stays still.
 */
export function AuthPane({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useRouteFade(ref, usePathname(), { rise: true });

  return (
    <div ref={ref} className="flex w-full justify-center">
      {children}
    </div>
  );
}
