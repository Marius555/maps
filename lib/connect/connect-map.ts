import "server-only";

import type { RepoContext } from "@/lib/repositories/context";
import { updateMap } from "@/lib/repositories/maps.repository";
import { publishMap } from "@/lib/repositories/publish.repository";
import type { AppMap } from "@/lib/repositories/types";
import { allowSite } from "./wordpress";

export type PreparedMap = {
  map: AppMap;
  /** Whether this call published it. */
  published: boolean;
  /** A host could not be added because the allowlist is full; the map won't show there. */
  siteRefused: boolean;
};

/**
 * Get a map ready to be shown on a platform's site: let the site's hosts
 * through a restricted allowlist, and publish when the live snapshot is
 * missing or still carries the old list. The WordPress connect route and the
 * Shopify storefront route both do exactly this (docs/notes/distribution.md,
 * "Why connecting publishes").
 *
 * - **An empty allowlist stays empty** — it means every site (`allowSite`).
 * - **Publishing publishes whatever the map holds now**, unpublished edits
 *   included; each caller's UI says so before the owner presses the button.
 */
export async function prepareMapForSites(
  ctx: RepoContext,
  map: AppMap,
  hosts: readonly string[],
  origin: string,
): Promise<PreparedMap> {
  let domains = map.allowedDomains;
  let added = false;
  let siteRefused = false;

  for (const host of new Set(hosts)) {
    const result = allowSite(domains, host);
    if (result.kind === "added") {
      domains = result.domains;
      added = true;
    } else if (result.kind === "full") {
      siteRefused = true;
    }
  }

  let current = map;
  if (added) current = await updateMap(ctx, current.id, { allowedDomains: domains });

  const published = !current.publishedAt || added;
  if (published) current = (await publishMap(ctx, current.id, origin)).map;

  return { map: current, published, siteRefused };
}
