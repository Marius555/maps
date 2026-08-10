import type { AppMap, Place } from "@/lib/repositories/types";
import type { MapSnapshot } from "@/packages/shared/snapshot";
import { buildSnapshot } from "./build";

/**
 * The snapshot a preview renders — what Publish *would* write, right now.
 *
 * `buildSnapshot` is pure and has no server-only import in its chain, so the
 * dashboard can call it in the browser and hand the result straight to the real
 * embed bundle. That is the whole point: the preview is not a reimplementation
 * of the embed, it is the embed, and so it cannot drift from what ships.
 *
 * Two deliberate differences from the published article:
 *
 * `allowedDomains` is cleared. The list exists to stop the snippet working on
 * sites that aren't the customer's — and the dashboard is one of those sites.
 * Left in, a customer who had locked their map to their own domain would find
 * the preview refusing to render on the very page offering it.
 *
 * `generatedAt` comes from the map rather than the clock. Nothing renders it, and
 * a fresh timestamp on every call would make two otherwise identical previews
 * compare unequal — which is what the caller uses to decide whether to rebuild
 * the frame at all.
 */
export function buildPreviewSnapshot(map: AppMap, places: Place[]): MapSnapshot {
  const { snapshot } = buildSnapshot(map, places, map.updatedAt);

  return { ...snapshot, allowedDomains: [] };
}
