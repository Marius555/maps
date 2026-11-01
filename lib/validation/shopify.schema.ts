import { z } from "zod";

/** "Show on storefront" for one map, in the Shopify app (docs/notes/shopify.md). */
export const storefrontMapSchema = z.object({
  /** Make this the map a Pinglide block shows when it names no map code. */
  makeDefault: z.boolean().default(false),
});
