import { ok } from "@/lib/api/responses";
import { withMapAuth } from "@/lib/api/route";
import { currentIdToken } from "@/lib/auth/shopify-user";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/repositories/errors";
import { getMap } from "@/lib/repositories/maps.repository";
import { adminSession } from "@/lib/shopify/admin-api";
import { readShopLocations } from "@/lib/shopify/locations";
import { shopifyLocationsTable } from "@/lib/shopify/locations-table";
import { grantsScopes, LOCATIONS_SCOPE } from "@/lib/shopify/scopes";

type Params = { id: string };

/**
 * The shop's own Shopify locations, as an import table — "Import from Shopify"
 * in the import wizard (docs/notes/shopify.md, "Import from Shopify").
 *
 * Only from inside the Shopify admin: the read needs the request's ID token to
 * exchange for an Admin API token, and none is stored. It needs the optional
 * `read_locations` scope, which the wizard asks the merchant for (App Bridge's
 * Scopes API) before calling here; a 403 says so if it was declined or never
 * asked. The answer is the same `SourceTable` every file becomes, so the rest
 * is the ordinary import — nothing is written here.
 *
 * Runs while the merchant builds the map, never when a visitor loads it (§2).
 */
export const GET = withMapAuth<Params>(async ({ params, user, ctx }) => {
  await getMap(ctx, params.id);

  if (!user.shopify) throw new NotFoundError("Importing Shopify locations works inside the Shopify admin.");

  const idToken = await currentIdToken();
  if (!idToken || idToken.shop !== user.shopify.shop) throw new UnauthorizedError();

  const session = await adminSession(idToken.shop, idToken.token, { scopes: [LOCATIONS_SCOPE] });
  if (!grantsScopes(session.scope, [LOCATIONS_SCOPE])) {
    throw new ForbiddenError(
      "Pinglide doesn't have access to your store's locations yet. Press Import from Shopify again and choose Allow.",
    );
  }

  return ok({ table: shopifyLocationsTable(await readShopLocations(session)) });
}, { rateLimit: "shopifyImport" });
