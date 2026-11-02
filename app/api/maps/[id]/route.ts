import { after } from "next/server";

import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withMapAuth } from "@/lib/api/route";
import {
  deleteMap,
  getMap,
  updateMap,
} from "@/lib/repositories/maps.repository";
import { storefrontCleanupFor } from "@/lib/shopify/storefront-cleanup";
import { updateMapSchema } from "@/lib/validation/map.schema";

type Params = { id: string };

export const GET = withMapAuth<Params>(async ({ params, ctx }) =>
  ok({ map: await getMap(ctx, params.id) }),
);

export const PATCH = withMapAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, updateMapSchema);
  return ok({ map: await updateMap(ctx, params.id, input) });
});

export const DELETE = withMapAuth<Params>(async ({ params, ctx, user }) => {
  await deleteMap(ctx, params.id);

  // Inside the Shopify admin, also off the storefront — after answering, since
  // it is three Shopify calls the merchant need not wait for.
  const cleanup = await storefrontCleanupFor(user, params.id);
  if (cleanup) after(cleanup);

  return noContent();
});
