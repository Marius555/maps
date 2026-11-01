import "server-only";

import { env } from "@/lib/env";
import { adminGraphql, ShopifyApiError, type AdminSession } from "./admin-api";
import { parseStorefrontMaps, type StorefrontMaps } from "./storefront-maps";

/**
 * Reading and writing the app-data metafield the theme block reads
 * (`./storefront-maps.ts` has its shape and rules). App-data metafields live on
 * the app installation, take any namespace, need no access scope, and are
 * readable only by this app — in GraphQL and in its own Liquid.
 */

const NAMESPACE = "pinglide";
const KEY = "maps";

export async function readStorefrontMaps(
  session: AdminSession,
): Promise<{ installationId: string; data: StorefrontMaps | null }> {
  const result = await adminGraphql<{
    currentAppInstallation: { id: string; metafield: { value: string } | null };
  }>(
    session,
    `query PinglideStorefrontMaps {
      currentAppInstallation {
        id
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") { value }
      }
    }`,
  );

  return {
    installationId: result.currentAppInstallation.id,
    data: parseStorefrontMaps(result.currentAppInstallation.metafield?.value),
  };
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
