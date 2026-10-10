import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { allowSite, siteHost } from "@/lib/connect/wordpress";
import { embedScriptUrl } from "@/lib/embed/snippet";
import { createMap, getMap, updateMap } from "@/lib/repositories/maps.repository";
import { publishMap } from "@/lib/repositories/publish.repository";
import { connectMapSchema } from "@/lib/validation/connect.schema";
import { createMapSchema } from "@/lib/validation/map.schema";

/**
 * Gets a map ready to show on a WordPress site the owner just pressed "Set up
 * this map" on, and answers with what the plugin stores. The browser then
 * carries that back to wp-admin — `components/connect/connect-flow.tsx`.
 *
 * Three things, each only when needed:
 *
 * - **Create** the map, when that is what was asked. Plan limits apply exactly as
 *   they do on the Maps page, because this is `createMap`.
 * - **Allow** the site, when the map's allowlist is already restricted. An empty
 *   list stays empty — it means everywhere (`allowSite`).
 * - **Publish**, when the map has never been published or the allowlist just
 *   changed. The second case publishes whatever the map holds now, unpublished
 *   edits included — the connect page says so before the owner presses Connect. Without the first, the block on the owner's page is an empty box
 *   until they find the Publish tab; with it, it is a map from the first
 *   second. Without the second, the live snapshot still carries the old list and
 *   the embed refuses to draw on the site that was just allowed.
 *
 * Nothing here runs when a visitor loads that page — the plugin stores the
 * snapshot URL and the page reads it from the CDN like any pasted snippet (§2).
 */
export const POST = withAuth(async ({ request, ctx }) => {
  const input = await parseBody(request, connectMapSchema);
  const origin = new URL(request.url).origin;
  const host = siteHost(input.site);

  let map =
    "create" in input.map
      ? // Parsed again for the defaults the Maps page's form gets: style, centre, zoom.
        await createMap(ctx, createMapSchema.parse({ name: input.map.name }))
      : await getMap(ctx, input.map.id);

  const allowed = allowSite(map.allowedDomains, host);
  if (allowed.kind === "added") {
    map = await updateMap(ctx, map.id, { allowedDomains: allowed.domains });
  }

  const publish = !map.publishedAt || allowed.kind === "added";
  if (publish) map = (await publishMap(ctx, map.id, origin)).map;

  return ok({
    map: {
      mapId: map.id,
      name: map.name,
      // Set by the publish above when it ran, and by an earlier one when it didn't.
      snapshotUrl: map.snapshotUrl ?? "",
      scriptUrl: embedScriptUrl(origin),
    },
    published: publish,
    /** The site could not be added because the list is full; the map won't show there. */
    siteRefused: allowed.kind === "full",
  });
  // The publish route's limit, because this can publish.
}, { rateLimit: "publish" });

