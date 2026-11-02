import { isDomainAllowed } from "@/lib/validation/domain.schema";

/**
 * The shop's hosts that a map's site list leaves out — where the embed would
 * refuse to draw it (docs/notes/shopify.md, "Storefront").
 *
 * The usual way to get here: a map with a restricted list goes on the
 * storefront while the shop is `x.myshopify.com`, and the merchant connects a
 * custom domain later. The block still loads the map, the embed checks
 * `allowedDomains` against the custom domain, and the map is blank. An empty
 * list means every site and is never missing anything.
 *
 * Pure, so the rule is tested without Shopify; the same check the embed makes
 * (`isDomainAllowed`).
 */
export function hostsMissing(allowed: readonly string[], hosts: readonly string[]): string[] {
  return [...new Set(hosts.filter(Boolean))].filter((host) => !isDomainAllowed(host, [...allowed]));
}
