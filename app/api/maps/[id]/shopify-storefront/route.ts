import { ok } from "@/lib/api/responses";
import { parseBody, withMapAuth } from "@/lib/api/route";
import { currentIdToken } from "@/lib/auth/shopify-user";
import type { AuthUser } from "@/lib/auth/types";
import { prepareMapForSites } from "@/lib/connect/connect-map";
import { embedScriptUrl } from "@/lib/embed/snippet";
import { env } from "@/lib/env";
import { NotFoundError, UnauthorizedError } from "@/lib/repositories/errors";
import { getMap } from "@/lib/repositories/maps.repository";
import { findShop, type ShopifyShop } from "@/lib/repositories/shopify-shops.repository";
import type { AppMap } from "@/lib/repositories/types";
import { adminSession, type AdminSession } from "@/lib/shopify/admin-api";
import {
  addBlockUrl,
  deleteStorefrontMapEntry,
  readStorefront,
  upsertStorefrontMapEntry,
  writeStorefrontMaps,
} from "@/lib/shopify/storefront";
import {
  pickerName,
  withoutStorefrontMap,
  withScript,
  withStorefrontMap,
} from "@/lib/shopify/storefront-maps";
import { storefrontMapSchema } from "@/lib/validation/shopify.schema";

/**
 * One map on the shop's storefront — the Shopify app's "Show on storefront"
 * (docs/notes/shopify.md, "Storefront").
 *
 * - `GET` — whether it is on the storefront, and whether it is the default.
 *   It also heals what the theme block reads, writing only what differs: a
 *   `script` left pointing at a dead dev tunnel, and a missing or misnamed
 *   picker entry (maps shown before the picker existed, maps renamed since).
 * - `POST` — put it there: let the shop's domains through a restricted
 *   allowlist, publish when needed (`prepareMapForSites`, the WordPress
 *   connect's rules), then add it to the app-data metafield and to the block's
 *   "Map" picker. Answers with the theme editor link that adds the block.
 * - `DELETE` — take it off the list and out of the picker. The live snapshot is
 *   untouched: anywhere else the map is shown keeps working.
 *
 * Only from inside the Shopify admin, because writing to Shopify needs the
 * request's own ID token to exchange for an Admin API token — none is stored.
 * Nothing here runs when a storefront visitor loads a page (§2).
 */

async function shopifyContext(user: AuthUser): Promise<{ shop: ShopifyShop; session: AdminSession }> {
  if (!user.shopify) throw new NotFoundError("This is only for maps in the Shopify app.");

  const idToken = await currentIdToken();
  if (!idToken || idToken.shop !== user.shopify.shop) throw new UnauthorizedError();

  const shop = await findShop(idToken.shop);
  if (!shop) throw new UnauthorizedError();

  return { shop, session: await adminSession(shop.shop, idToken.token) };
}

function status(map: AppMap, shop: ShopifyShop, onStorefront: boolean, isDefault: boolean) {
  return { onStorefront, isDefault, name: map.name, addBlockUrl: addBlockUrl(shop.shop) };
}

export const GET = withMapAuth<{ id: string }>(async ({ params, user, ctx }) => {
  const map = await getMap(ctx, params.id);
  const { shop, session } = await shopifyContext(user);
  const { installationId, data, entry } = await readStorefront(session, map.id);
  const listed = data?.maps[map.id];

  if (listed) {
    // The configured origin, never the request's: behind the dev tunnel that
    // is `https://localhost:…` (`appOrigin`, lib/shopify/bounce.ts).
    const healed = withScript(data, embedScriptUrl(env.appUrl));
    if (healed) await writeStorefrontMaps(session, installationId, healed);

    if (!entry || entry.name !== pickerName(map.name)) {
      await upsertStorefrontMapEntry(session, map.id, { name: map.name, snapshot: listed.snapshot });
    }
  }

  return ok(status(map, shop, Boolean(listed), data?.default === map.id));
});

export const POST = withMapAuth<{ id: string }>(
  async ({ request, params, user, ctx }) => {
    const input = await parseBody(request, storefrontMapSchema);
    const { shop, session } = await shopifyContext(user);
    // The configured origin, for the embed script URL and the publish: behind
    // the dev tunnel the request's is `https://localhost:…`, which a storefront
    // would then load `map.js` from (`appOrigin`, lib/shopify/bounce.ts).
    const origin = env.appUrl;

    const { map, published, siteRefused } = await prepareMapForSites(
      ctx,
      await getMap(ctx, params.id),
      [shop.shop, shop.primaryDomain],
      origin,
    );

    const { installationId, data } = await readStorefront(session, map.id);
    const entry = { name: map.name, snapshot: map.snapshotUrl ?? "" };
    const next = withStorefrontMap(data, map.id, entry, {
      makeDefault: input.makeDefault,
      script: embedScriptUrl(origin),
    });
    await writeStorefrontMaps(session, installationId, next);
    // `prepareMapForSites` publishes a map that never was, so this is only
    // empty for a map whose publish failed — which threw above.
    if (entry.snapshot) await upsertStorefrontMapEntry(session, map.id, entry);

    return ok({
      ...status(map, shop, true, next.default === map.id),
      published,
      siteRefused,
    });
  },
  // The publish route's limit, because this can publish.
  { rateLimit: "publish" },
);

export const DELETE = withMapAuth<{ id: string }>(async ({ params, user, ctx }) => {
  const map = await getMap(ctx, params.id);
  const { shop, session } = await shopifyContext(user);

  const { installationId, data, entry } = await readStorefront(session, map.id);
  const next = withoutStorefrontMap(data, map.id);
  if (next) await writeStorefrontMaps(session, installationId, next);
  if (entry) await deleteStorefrontMapEntry(session, entry.id);

  return ok(status(map, shop, false, false));
});
