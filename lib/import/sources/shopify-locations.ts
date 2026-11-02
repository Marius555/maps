import { apiFetch } from "@/lib/query/fetcher";
import { ensureScope } from "@/lib/shopify/app-bridge-scopes";
import { LOCATIONS_SCOPE } from "@/lib/shopify/scopes";
import { ImportSourceError, type SourceTable } from "./types";

/**
 * The shop's own Shopify locations, via our route (docs/notes/shopify.md,
 * "Import from Shopify").
 *
 * First the permission: reading locations is an optional scope, so the
 * merchant is asked for it here, the moment they press the button that needs
 * it, in Shopify's own dialog. Then one request, which answers the same
 * `SourceTable` a file becomes — everything after is the ordinary import.
 */
export async function readShopifyLocations(mapId: string): Promise<SourceTable> {
  const permission = await ensureScope(LOCATIONS_SCOPE);

  if (permission === "declined") {
    throw new ImportSourceError(
      "Pinglide needs permission to read your store's locations. Press Import from Shopify again and choose Allow.",
    );
  }

  if (permission === "failed") {
    throw new ImportSourceError(
      "Shopify couldn't show the permission prompt for your locations. Reload Pinglide and try again, or upload your locations as a file.",
    );
  }

  const { table } = await apiFetch<{ table: SourceTable }>(`/api/maps/${mapId}/import/shopify-locations`);

  // The header row is always there; only it means no location had an address.
  if (table.cells.length <= 1) {
    throw new ImportSourceError(
      "Your store has no active locations with an address yet. Add one in Shopify under Settings → Locations, then try again.",
    );
  }

  return table;
}
