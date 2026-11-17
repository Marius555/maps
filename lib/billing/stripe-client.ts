import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

/**
 * The plumbing every Stripe call shares: one client, one error type, the id
 * guard. `stripe.ts` (subscriptions, invoices, checkout) and
 * `stripe-discounts.ts` both go through `call`, so a refusal reads the same
 * everywhere. Nothing outside `lib/billing/` imports this.
 */

/**
 * Longer than a page would wait, shorter than the platform's own request cap.
 *
 * Appwrite Sites cuts every request off at 30 seconds (CLAUDE.md §12), so a
 * checkout that hangs must fail with a message rather than be killed without one.
 */
const TIMEOUT_MS = 10_000;

/** One parameter the provider refused, and what it said about it. */
export type RefusedField = { attribute: string; detail: string };

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /**
     * The request parameters the provider named in a refusal (`code`,
     * `expires_at`…) with its own sentence for each. Only the operator console
     * reads them, to put a refusal under the field it is about; a customer is
     * never shown the provider's own words.
     */
    readonly fields: readonly RefusedField[] = [],
  ) {
    super(message);
    this.name = "BillingError";
  }
}

/*
 * On `globalThis`, not a module variable: Next keeps one copy of a module's state
 * for route handlers and another for pages in the same process, and one client
 * per process is the point.
 */
const holder = globalThis as typeof globalThis & { __pinglideStripe?: Stripe };

/**
 * The client, made on first use with the SDK's own pinned API version.
 *
 * Read at call time, not at module load, and named in the failure: a missing
 * key should fail the one thing that needs it, with the variable's name in the
 * message, rather than throw during import and take down every page in the
 * dashboard including the ones that have nothing to do with billing.
 */
export function stripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new BillingError(
      "STRIPE_SECRET_KEY is not set, so billing is unavailable. Add it to .env and restart.",
    );
  }

  holder.__pinglideStripe ??= new Stripe(env.stripeSecretKey, {
    timeout: TIMEOUT_MS,
    // Idempotency keys are added by the SDK on retried POSTs, so a retry
    // cannot make a second checkout or a second coupon.
    maxNetworkRetries: 1,
    appInfo: { name: "pinglide" },
  });

  return holder.__pinglideStripe;
}

/**
 * The provider's ids carry a prefix (`sub_`, `promo_`, `cus_`), and anything
 * else is refused before it reaches a request.
 *
 * Ids come from our own rows or from the operator console. The SDK encodes path
 * segments, so this is not what stops a path being spliced — it is what turns a
 * row left over from another provider (a Lemon Squeezy number, a Shopify plan
 * handle) into a clean 404 rather than a confusing upstream error.
 */
export function assertStripeId(id: string, prefix: string, what = "id"): string {
  if (!new RegExp(`^${prefix}_[A-Za-z0-9]{1,250}$`).test(id)) {
    throw new BillingError(`That ${what} isn't one the payment provider issued.`, 404);
  }

  return id;
}

/** Stripe's parameter names as the ones our forms know them by. */
const ATTRIBUTE_FOR: Record<string, string> = {
  percent_off: "amount",
  amount_off: "amount",
};

/**
 * One request, with every failure turned into a `BillingError`.
 *
 * The provider's message is logged and never returned: it can name the
 * account, the price and the key's own permissions, none of which is a
 * customer's business — and the customer's next action is the same whatever it
 * says. A refusal about one parameter is a 422 carrying that parameter, which is
 * what the operator console puts under a form field.
 */
export async function call<T>(what: string, run: (client: Stripe) => Promise<T>): Promise<T> {
  const client = stripe();

  try {
    return await run(client);
  } catch (error) {
    if (error instanceof BillingError) throw error;

    if (error instanceof Stripe.errors.StripeError) {
      console.error(`Stripe ${what} failed: ${String(error.statusCode ?? "")} ${error.type} ${error.message}`);

      if (error instanceof Stripe.errors.StripeConnectionError) {
        throw new BillingError("Couldn't reach the payment provider.");
      }

      const status = error.statusCode ?? 502;
      const param = error.param ? (ATTRIBUTE_FOR[error.param] ?? error.param) : null;

      if (param && status === 400) {
        throw new BillingError(
          "The payment provider refused that. Check the values and try again.",
          422,
          [{ attribute: param, detail: error.message }],
        );
      }

      throw new BillingError("The payment provider refused that. Try again in a moment.", status);
    }

    console.error(`Stripe ${what} failed:`, error);

    throw new BillingError("Couldn't reach the payment provider.");
  }
}

/** Seconds since the epoch, as the provider sends times, to ISO. Null stays null. */
export function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/** ISO to seconds since the epoch, for a request. */
export function unixFromIso(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

export type { Stripe };
