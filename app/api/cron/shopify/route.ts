import { refuseUnlessCron } from "@/lib/api/cron-auth";
import { ok } from "@/lib/api/responses";
import { withoutAuth } from "@/lib/api/route";
import { runShopifySweepStep } from "@/lib/shopify/plan-sync";

/**
 * How long one step may spend. Well inside the site's 15-second default
 * timeout (§12), which also has to cover the request around it.
 */
const STEP_MS = 8_000;

/**
 * One step of the Shopify sweep (lib/shopify/plan-sync.ts): re-read the plans
 * Shopify changed or is about to renew, then erase shops Shopify asked us to
 * (`shop/redact`).
 *
 * Called by the scheduled function (functions/sheet-sync) every hour, again
 * and again until it answers `more: false`. Idempotent: a step repeated or cut
 * off finds the same work, or less.
 */
export const POST = withoutAuth(async (request) => {
  const denied = refuseUnlessCron(request);
  if (denied) return denied;

  return ok(await runShopifySweepStep({ deadline: Date.now() + STEP_MS }));
});
