import { gazetteerBase } from "@/lib/gazetteer/config";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import type { CardLayout } from "@/packages/shared/card-layout";
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
 * Three deliberate differences from the published article:
 *
 * `allowedDomains` is cleared. The list exists to stop the snippet working on
 * sites that aren't the customer's — and the dashboard is one of those sites.
 * Left in, a customer who had locked their map to their own domain would find
 * the preview refusing to render on the very page offering it.
 *
 * The gazetteer base comes from the browser's own origin, so the preview's
 * search reads the same shards the published map will. `globalThis` rather than
 * `window` because this file is imported by tests running under node, where the
 * base then comes out empty and the block is simply omitted.
 *
 * `generatedAt` comes from the map rather than the clock. Nothing renders it, and
 * a fresh timestamp on every call would make two otherwise identical previews
 * compare unequal — which is what the caller uses to decide whether to rebuild
 * the frame at all.
 *
 * No collector URL is passed, so the preview reports nothing however the owner
 * has set `settings.analytics`. It is not an omission to fix: the preview is the
 * real embed bundle running inside the dashboard, and a preview that reported
 * would file the owner's own clicks on their own map as a visitor's. The switch
 * still shows its state in the designer; only the measurement is withheld.
 */
export function buildPreviewSnapshot(
  map: AppMap,
  places: Place[],
  shapes: Shape[],
  /** The account's own card design — see buildSnapshot's own parameter. */
  cardLayout?: CardLayout | null,
): MapSnapshot {
  const origin = globalThis.location?.origin ?? "";
  const { snapshot } = buildSnapshot(
    map,
    places,
    shapes,
    map.updatedAt,
    origin ? gazetteerBase(origin) : undefined,
    cardLayout,
  );

  return { ...snapshot, allowedDomains: [] };
}
