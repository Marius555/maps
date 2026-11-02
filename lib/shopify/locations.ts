import "server-only";

import { adminGraphql, type AdminSession } from "./admin-api";
import type { ShopifyLocationNode } from "./locations-table";

/**
 * Every active location of the shop, from the Admin API (docs/notes/shopify.md,
 * "Import from Shopify"). Needs `read_locations`, an optional scope the
 * merchant grants from the import's own button — the caller checks the session
 * has it.
 *
 * Paged at Shopify's 250, and stopped at `MAX_LOCATIONS`: a shop with more than
 * that has far more than any plan imports in one go, and the import's own row
 * limit applies after this anyway. Legacy and inactive locations are left out
 * by the query; fulfillment services by `isMappableLocation`.
 *
 * Only ever called with a merchant in the app, never per storefront visitor (§2).
 */

const PAGE = 250;
const MAX_LOCATIONS = 5_000;

type LocationsPage = {
  locations: {
    nodes: ShopifyLocationNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function readShopLocations(session: AdminSession): Promise<ShopifyLocationNode[]> {
  const nodes: ShopifyLocationNode[] = [];
  let after: string | null = null;

  do {
    const page: LocationsPage = await adminGraphql<LocationsPage>(
      session,
      `query PinglideShopifyLocations($after: String) {
        locations(first: ${PAGE}, after: $after, includeInactive: false, includeLegacy: false) {
          nodes {
            name
            isFulfillmentService
            address {
              address1
              address2
              city
              province
              zip
              country
              phone
              latitude
              longitude
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after },
    );

    nodes.push(...page.locations.nodes);
    after = page.locations.pageInfo.hasNextPage ? page.locations.pageInfo.endCursor : null;
  } while (after && nodes.length < MAX_LOCATIONS);

  return nodes;
}
