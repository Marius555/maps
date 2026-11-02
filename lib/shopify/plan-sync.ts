import "server-only";

import { runDeletionStep } from "@/lib/account-deletion/step";
import { deletionStoreFor } from "@/lib/account-deletion/store";
import { forgetUser } from "@/lib/auth/identity-cache";
import { toShopifyState } from "@/lib/billing/shopify-pricing";
import type { SubscriptionState } from "@/lib/billing/types";
import { captureServerEvent } from "@/lib/posthog/server";
import { ownerContext } from "@/lib/repositories/context";
import {
  deleteShop,
  findShop,
  findShopByWorkspace,
  listShopsDueForRedaction,
  updateShop,
  type ShopifyShop,
} from "@/lib/repositories/shopify-shops.repository";
import {
  getSubscription,
  listShopifySubscriptionsEndingBefore,
  upsertSubscription,
} from "@/lib/repositories/subscriptions.repository";
import {
  fetchActiveSubscription,
  partnerApiConfigured,
  recentSubscriptionEvents,
  type SubscriptionEvent,
} from "./partner-api";
import { shopifyPlanPurchase } from "./funnel";

/**
 * Keeping a shop's `subscriptions` row in step with Shopify App Pricing
 * (docs/notes/shopify.md, "Billing").
 *
 * Shopify sends nothing when a plan changes, renews, is cancelled or frozen —
 * App Pricing stopped sending webhooks on 2026-04-28 — so the row is re-read
 * from the Partner API at three moments:
 *
 * 1. **The App Home**, when the stored answer is older than `STALE_MS`, and
 *    always right after the merchant chose a plan (`plan_handle` on the URL).
 * 2. **The hourly sweep**, for every shop with a subscription event in the
 *    last few hours.
 * 3. **The hourly sweep**, for every Shopify-billed plan ending within
 *    `RENEWAL_HORIZON_MS` — a renewal moves the end date, and nothing else
 *    would tell us.
 *
 * Every re-read writes the whole state (`upsertSubscription` replaces), so
 * reading twice is the same as reading once.
 *
 * **Frozen is sticky.** `activeSubscription` has no status field, so whether
 * Shopify froze a subscription (an unpaid store bill) is known only from the
 * event. A re-read with no event in hand keeps a stored freeze; only an
 * `UNFROZEN` event or the merchant choosing a plan lifts it.
 */

const STALE_MS = 6 * 60 * 60_000;
/** How far back the sweep reads events. Overlaps the hourly interval on purpose. */
const EVENT_WINDOW_MS = 3 * 60 * 60_000;
const RENEWAL_HORIZON_MS = 2 * 24 * 60 * 60_000;
/** A shop re-read this recently is skipped by the sweep's renewal pass. */
const RECHECK_MS = 50 * 60_000;
const SWEEP_BATCH = 50;

type Freeze = "freeze" | "unfreeze" | "keep";

/** The App Home's re-read. Never throws into the caller's way — the caller catches. */
export async function reconcileShopPlan(
  shop: ShopifyShop,
  { justChose }: { justChose: boolean },
): Promise<void> {
  if (!partnerApiConfigured() || !shop.shopGid) return;

  const fresh =
    shop.planCheckedAt !== null && Date.now() - Date.parse(shop.planCheckedAt) < STALE_MS;
  if (fresh && !justChose) return;

  const { before, after } = await refreshShopPlan(shop, justChose ? "unfreeze" : "keep");

  // The funnel's last step, which a Lemon Squeezy purchase sends from its
  // return page. Only on the return from Shopify's plan page — never from the
  // hourly sweep, so a renewal is not a purchase.
  const bought = justChose ? shopifyPlanPurchase(before, after) : null;
  if (bought) await captureServerEvent(shop.workspaceId, "checkout_completed", bought);
}

async function refreshShopPlan(
  shop: ShopifyShop,
  freeze: Freeze,
): Promise<{ before: SubscriptionState | null; after: SubscriptionState }> {
  const subscription = await fetchActiveSubscription(shop.shopGid);
  const before = await getSubscription(shop.workspaceId);

  const frozen =
    freeze === "freeze" ||
    (freeze === "keep" && before?.provider === "shopify" && before.status === "paused");

  const after = toShopifyState({ workspaceId: shop.workspaceId, shop: shop.shop, subscription, frozen });
  await upsertSubscription(after);
  await updateShop(shop.id, { planCheckedAt: new Date().toISOString() });
  forgetUser(shop.workspaceId);

  return { before, after };
}

export type ShopifySweepStep = {
  /** Whether another step may find more to do. */
  more: boolean;
  refreshed: number;
  redacted: number;
  failed: number;
};

/**
 * One bounded step of the hourly sweep: plans first, then shops Shopify asked
 * us to erase. The scheduled function calls it until `more` is false.
 */
export async function runShopifySweepStep(input: {
  deadline: number;
  now?: Date;
}): Promise<ShopifySweepStep> {
  const now = input.now ?? new Date();
  const step: ShopifySweepStep = { more: false, refreshed: 0, redacted: 0, failed: 0 };
  const outOfTime = () => Date.now() >= input.deadline;

  if (partnerApiConfigured()) {
    // Caught here, not left to throw: the erasure pass below answers Shopify's
    // shop/redact webhook, a compliance duty that must not wait on the Partner
    // API being up — or on its token being right.
    let due: Awaited<ReturnType<typeof shopsToRefresh>> = [];
    try {
      due = await shopsToRefresh(now);
    } catch (error) {
      console.error("[shopify] finding plans to re-read failed:", error);
      step.failed += 1;
    }

    for (const { shop, freeze } of due) {
      if (outOfTime()) return { ...step, more: true };

      try {
        await refreshShopPlan(shop, freeze);
        step.refreshed += 1;
      } catch (error) {
        // One shop failing must not stop the rest; the next hour retries it.
        console.error(`[shopify] re-reading the plan for ${shop.shop} failed:`, error);
        step.failed += 1;
      }
    }
  }

  for (const shop of await listShopsDueForRedaction(now)) {
    if (outOfTime()) return { ...step, more: true };

    const progress = await runDeletionStep(deletionStoreFor(ownerContext(shop.workspaceId)), {
      budgetMs: Math.max(1_000, input.deadline - Date.now()),
    });
    if (!progress.done) return { ...step, more: true };

    await deleteShop(shop.id);
    step.redacted += 1;
  }

  return step;
}

/**
 * Which shops this step re-reads: one with a subscription event newer than its
 * last re-read (the newest event decides any freeze), then plans that end
 * soon and were not just re-read.
 */
async function shopsToRefresh(now: Date): Promise<{ shop: ShopifyShop; freeze: Freeze }[]> {
  const picked = new Map<string, { shop: ShopifyShop; freeze: Freeze }>();

  const events = await recentSubscriptionEvents(new Date(now.getTime() - EVENT_WINDOW_MS));
  for (const event of newestPerShop(events)) {
    const shop = await findShop(event.shop);
    if (!shop || shop.uninstalledAt) continue;
    if (shop.planCheckedAt && Date.parse(shop.planCheckedAt) > Date.parse(event.occurredAt)) continue;

    picked.set(shop.shop, { shop, freeze: freezeFor(event.eventType) });
    if (picked.size >= SWEEP_BATCH) return [...picked.values()];
  }

  const ending = await listShopifySubscriptionsEndingBefore(
    new Date(now.getTime() + RENEWAL_HORIZON_MS),
    SWEEP_BATCH,
  );
  for (const workspaceId of ending) {
    const shop = await findShopByWorkspace(workspaceId);
    if (!shop || shop.uninstalledAt || picked.has(shop.shop)) continue;
    if (shop.planCheckedAt && now.getTime() - Date.parse(shop.planCheckedAt) < RECHECK_MS) continue;

    picked.set(shop.shop, { shop, freeze: "keep" });
  }

  return [...picked.values()];
}

/** Events arrive newest first; keep the first one seen for each shop. */
function newestPerShop(events: SubscriptionEvent[]): SubscriptionEvent[] {
  const seen = new Set<string>();

  return events.filter((event) => {
    if (seen.has(event.shop)) return false;
    seen.add(event.shop);
    return true;
  });
}

function freezeFor(eventType: string): Freeze {
  if (eventType === "SUBSCRIPTION_FROZEN") return "freeze";
  if (eventType === "SUBSCRIPTION_UNFROZEN") return "unfreeze";
  return "keep";
}
