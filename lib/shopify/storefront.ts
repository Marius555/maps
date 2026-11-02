import "server-only";

import { env } from "@/lib/env";
import { adminGraphql, ShopifyApiError, type AdminSession } from "./admin-api";
import {
  parseStorefrontMaps,
  storefrontMapFields,
  type StorefrontMap,
  type StorefrontMaps,
} from "./storefront-maps";

/**
 * What the theme block reads, written from here (`./storefront-maps.ts` has the
 * shapes and rules):
 *
 * - the app-data metafield `pinglide.maps` — the default map and `script`. It
 *   lives on the app installation, takes any namespace, needs no access scope
 *   and is readable only by this app, in GraphQL and in its own Liquid;
 * - one `$app:map` metaobject per map on the list, handle = map id — what the
 *   block's "Map" picker lists. App-owned, so it needs no access scope either;
 *   the definition is declared in distribution/shopify/shopify.app.toml.
 */

const NAMESPACE = "pinglide";
const KEY = "maps";
const MAP_TYPE = "$app:map";

/** This map's picker entry, as Shopify holds it. */
export type StorefrontMapEntry = { id: string; name: string | null };

/**
 * The metafield, this map's `$app:map` entry and the storefront's address, in
 * one request — every handler of the storefront route needs all three.
 *
 * `storeHost` is read fresh every time rather than trusted from the shop row,
 * which is written only at install: a merchant who connects a custom domain
 * afterwards would otherwise be shown on a domain the map's site list does not
 * name (`hostsMissing`). It needs no access scope.
 */
export async function readStorefront(
  session: AdminSession,
  mapId: string,
): Promise<{
  installationId: string;
  data: StorefrontMaps | null;
  entry: StorefrontMapEntry | null;
  /** The storefront's public host — a custom domain, or the shop domain. */
  storeHost: string;
}> {
  const result = await adminGraphql<{
    shop: { primaryDomain: { host: string } | null };
    currentAppInstallation: { id: string; metafield: { value: string } | null };
    metaobjectByHandle: { id: string; name: { value: string | null } | null } | null;
  }>(
    session,
    `query PinglideStorefrontMap($handle: MetaobjectHandleInput!) {
      shop { primaryDomain { host } }
      currentAppInstallation {
        id
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") { value }
      }
      metaobjectByHandle(handle: $handle) {
        id
        name: field(key: "name") { value }
      }
    }`,
    { handle: { type: MAP_TYPE, handle: mapId } },
  );

  const entry = result.metaobjectByHandle;

  return {
    installationId: result.currentAppInstallation.id,
    data: parseStorefrontMaps(result.currentAppInstallation.metafield?.value),
    entry: entry ? { id: entry.id, name: entry.name?.value ?? null } : null,
    storeHost: result.shop.primaryDomain?.host?.toLowerCase() || session.shop,
  };
}

/** Create or update this map's entry in the block's "Map" picker. */
export async function upsertStorefrontMapEntry(
  session: AdminSession,
  mapId: string,
  map: StorefrontMap,
): Promise<void> {
  const result = await adminGraphql<{
    metaobjectUpsert: { userErrors: { field: string[] | null; message: string }[] };
  }>(
    session,
    `mutation PinglideUpsertStorefrontMap($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message code }
      }
    }`,
    {
      handle: { type: MAP_TYPE, handle: mapId },
      metaobject: { fields: storefrontMapFields(map) },
    },
  );

  const error = result.metaobjectUpsert.userErrors[0];
  if (error) {
    throw new ShopifyApiError(`Shopify refused the storefront map entry: ${error.message}`, 502);
  }
}

/** Take this map's entry out of the picker. A block that had picked it falls back to the default map. */
export async function deleteStorefrontMapEntry(session: AdminSession, entryId: string): Promise<void> {
  const result = await adminGraphql<{
    metaobjectDelete: { userErrors: { field: string[] | null; message: string }[] };
  }>(
    session,
    `mutation PinglideDeleteStorefrontMap($id: ID!) {
      metaobjectDelete(id: $id) {
        deletedId
        userErrors { field message code }
      }
    }`,
    { id: entryId },
  );

  const error = result.metaobjectDelete.userErrors[0];
  if (error) {
    throw new ShopifyApiError(`Shopify refused to remove the storefront map entry: ${error.message}`, 502);
  }
}

export async function writeStorefrontMaps(
  session: AdminSession,
  installationId: string,
  data: StorefrontMaps,
): Promise<void> {
  const result = await adminGraphql<{
    metafieldsSet: { userErrors: { field: string[] | null; message: string }[] };
  }>(
    session,
    `mutation PinglideSetStorefrontMaps($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message code }
      }
    }`,
    {
      metafields: [
        {
          ownerId: installationId,
          namespace: NAMESPACE,
          key: KEY,
          type: "json",
          value: JSON.stringify(data),
        },
      ],
    },
  );

  const error = result.metafieldsSet.userErrors[0];
  if (error) {
    throw new ShopifyApiError(`Shopify refused the storefront map list: ${error.message}`, 502);
  }
}

/**
 * The theme editor, opened with the Pinglide block added to a new apps section
 * of the home page — Shopify's documented deep link; the merchant previews it
 * and saves.
 */
export function addBlockUrl(shop: string): string {
  const url = new URL(`https://${shop}/admin/themes/current/editor`);
  url.searchParams.set("addAppBlockId", `${env.shopifyClientId}/map`);
  url.searchParams.set("target", "newAppsSection");
  return url.toString();
}
