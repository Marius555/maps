import { z } from "zod";

/**
 * What `/upgrade` may be asked to open a checkout for.
 *
 * It parses a **query string**, which is to say a caller-controlled value that
 * arrives from a link anybody can edit — so the same rule applies as to a request
 * body, and this schema is the one place that rule is written down.
 *
 * **A plan and a cadence, never a price and never a variant id.** The temptation
 * is to put the variant in the link, since the page already knows it — and that
 * would let anyone swap in the id of the cheapest variant in the store while
 * claiming the Pro plan. What a plan costs is decided by `lib/billing/lemon.ts`
 * from configuration, which is the only place that is trustworthy.
 *
 * `free` is deliberately not in the enum. It is not something you buy, and
 * accepting it would mean a checkout that has to decide what a €0 purchase means.
 */
export const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"], {
    message: "Choose the Starter or Pro plan.",
  }),
  cadence: z.enum(["monthly", "yearly"]).default("monthly"),
});

export type CheckoutInput = z.output<typeof checkoutSchema>;
