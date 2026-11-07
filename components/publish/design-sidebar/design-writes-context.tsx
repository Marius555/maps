"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * "Wait until the designer's last change is saved", for anything that publishes.
 *
 * A publish is built on the server from the settings **as stored**, and the
 * designer stores them 400ms after a press (`useEmbedDesign`). So a Redeploy
 * pressed straight after a switch used to publish the setting from *before*
 * the switch, and the live map showed the opposite of what the switch said
 * (2026-11-07). Everything that publishes from this page awaits this first:
 * `PublishAction`, and Shopify's Show on storefront, which republishes too.
 *
 * A context rather than a prop, because the buttons that publish sit three
 * components below the one hook that owns the draft (`PublishPanel`), inside
 * both steppers. The default resolves at once, so a publish anywhere outside
 * the designer behaves as it always did.
 */
const DesignWrites = createContext<() => Promise<void>>(() => Promise.resolve());

export function DesignWritesProvider({
  settle,
  children,
}: {
  settle: () => Promise<void>;
  children: ReactNode;
}) {
  return <DesignWrites.Provider value={settle}>{children}</DesignWrites.Provider>;
}

export function useSettleDesign(): () => Promise<void> {
  return useContext(DesignWrites);
}
