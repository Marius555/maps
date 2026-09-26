"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import type { EmbedDesign } from "./use-embed-design";

/**
 * Carry out the Analytics tab's "Turn it on".
 *
 * That button used to link here and stop, and the switch it meant was in the
 * last fold of this sidebar, shut like every fold — so an owner pressed Publish
 * without ever seeing it and went back to the same "Measurement is off". Now it
 * links with `?analytics=on`, and this flips the switch once, through
 * `useEmbedDesign`, which stays the only writer of `maps.settings`. The sidebar
 * opens that fold at the same time, so the paragraph saying what gets recorded
 * is on screen beside the switch it describes. Publishing is still the owner's
 * press.
 *
 * The flag is then dropped from the URL, so reloading after switching it back
 * off by hand does not switch it on again.
 */
export function useTurnOnAnalytics(requested: boolean, design: EmbedDesign) {
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  const { settings, set } = design;

  useEffect(() => {
    if (!requested || done.current) return;
    done.current = true;

    // A write, not a render-time state change: `set` schedules the designer's
    // own debounced PATCH, which is exactly what pressing the switch does.
    if (!settings.analytics) set("analytics", true);

    router.replace(pathname, { scroll: false });
  }, [requested, settings.analytics, set, router, pathname]);
}
