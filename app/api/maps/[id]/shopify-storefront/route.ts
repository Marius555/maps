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
import { adminSession, type AdminSession } from "@/lib/shopify/admin-api";
import { addBlockUrl, readStorefrontMaps, writeStorefrontMaps } from "@/lib/shopify/storefront";
import { withoutStorefrontMap, withStorefrontMap } from "@/lib/shopify/storefront-maps";
import { storefrontMapSchema } from "@/lib/validation/shopify.schema";

/**
 * One map on the shop's storefront — the Shopify app's "Show on storefront"
 * (docs/notes/shopify.md, "Storefront").
 *
 * - `GET` — whether it is on the storefront, and whether it is the default.
 * - `POST` — put it there: let the shop's domains through a restricted
 *   allowlist, publish when needed (`prepareMapForSites`, the WordPress
 *   connect's rules), then add it to the app-data metafield the theme block
 *   reads. Answers with the map code and the theme editor link that adds the
 *   block.
 * - `DELETE` — take it off the list. The live snapshot is untouched: anywhere
 *   else the map is shown keeps working.
 *
 * Only from inside the Shopify admin, because writing the metafield needs the
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

export const GET = withMapAuth<{ id: string }>(async ({ params, user, ctx }) => {
  const map = await getMap(ctx, params.id);
  const { shop, session } = await shopifyContext(user);
  const { data } = await readStorefrontMaps(session);

  return ok({
    onStorefront: Boolean(data?.maps[map.id]),
    isDefault: data?.default === map.id,
    code: map.id,
    addBlockUrl: addBlockUrl(shop.shop),
  });
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

    const { installationId, data } = await readStorefrontMaps(session);
    const next = withStorefrontMap(
      data,
      map.id,
      { name: map.name, snapshot: map.snapshotUrl ?? "" },
      { makeDefault: input.makeDefault, script: embedScriptUrl(origin) },
    );
    await writeStorefrontMaps(session, installationId, next);

    return ok({
      onStorefront: true,
      isDefault: next.default === map.id,
      code: map.id,
      addBlockUrl: addBlockUrl(shop.shop),
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

  const { installationId, data } = await readStorefrontMaps(session);
  const next = withoutStorefrontMap(data, map.id);
  if (next) await writeStorefrontMaps(session, installationId, next);

  return ok({
    onStorefront: false,
    isDefault: false,
    code: map.id,
    addBlockUrl: addBlockUrl(shop.shop),
  });
});
