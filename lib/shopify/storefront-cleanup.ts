import "server-only";

import { currentIdToken } from "@/lib/auth/shopify-user";
import type { AuthUser } from "@/lib/auth/types";
import { adminSession } from "./admin-api";
import { deleteStorefrontMapEntry, readStorefront, writeStorefrontMaps } from "./storefront";
import { withoutStorefrontMap } from "./storefront-maps";

/**
 * Take a deleted map off the shop's storefront: out of the list the theme
 * block reads, and out of its "Map" picker (docs/notes/shopify.md,
 * "Storefront"). Without it a deleted default map left every default block
 * blank, and a deleted picked map stayed in the picker.
 *
 * Returns the work to run once the delete has answered (`after()`), or null
 * outside the Shopify admin. The ID token is read now, while the request is
 * certainly in hand; it lives a minute, far longer than this takes.
 *
 * **Best effort, never in the delete's way.** The map is already gone when this
 * runs. A failure is logged; the block then shows the default map, or nothing,
 * exactly as before this existed.
 */
export async function storefrontCleanupFor(
  user: AuthUser,
  mapId: string,
): Promise<(() => Promise<void>) | null> {
  if (!user.shopify) return null;

  const idToken = await currentIdToken();
  if (!idToken || idToken.shop !== user.shopify.shop) return null;

  return async () => {
    try {
      const session = await adminSession(idToken.shop, idToken.token);
      const { installationId, data, entry } = await readStorefront(session, mapId);

      if (data?.maps[mapId]) {
        const next = withoutStorefrontMap(data, mapId);
        if (next) await writeStorefrontMaps(session, installationId, next);
      }
      if (entry) await deleteStorefrontMapEntry(session, entry.id);
    } catch (error) {
      console.error(`[shopify] couldn't take deleted map ${mapId} off ${idToken.shop}'s storefront:`, error);
    }
  };
}
