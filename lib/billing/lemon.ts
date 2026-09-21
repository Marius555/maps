import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import type { PlanId } from "@/lib/repositories/plan-limits";
import type {
  BillingCadence,
  BillingProvider,
  Checkout,
  CheckoutRequest,
  PaidPlanId,
  SubscriptionState,
  SubscriptionStatus,
} from "./types";

/**
 * Lemon Squeezy, the merchant of record.
 *
 * **Everything provider-specific stops here.** Its vocabulary — variants, stores,
 * `on_trial`, the JSON:API envelope — is translated at this boundary and nothing
 * outside `lib/billing/` sees any of it, which is what CLAUDE.md §7 asks of a
 * provider folder and what lets §6's provider-neutral column names stay honest.
 *
 * Test mode is decided by the **key**, not by a flag we send. A test key produces
 * test checkouts and test webhooks; a live key produces real ones. There is
 * therefore nothing in this file that switches between them, and nothing that
 * could be left switched the wrong way on the day real money starts arriving.
 */

const API = "https://api.lemonsqueezy.com/v1";

/** JSON:API, which the provider requires on both headers rather than `application/json`. */
const MEDIA_TYPE = "application/vnd.api+json";

/**
 * Longer than a page would wait, shorter than the platform's own request cap.
 *
 * Appwrite Sites cuts every request off at 30 seconds (CLAUDE.md §12), so a
 * checkout that hangs must fail with a message rather than be killed without one.
 */
const TIMEOUT_MS = 10_000;

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export function createLemonProvider(): BillingProvider {
  return {
    name: "lemonsqueezy",
    createCheckout,
    portalUrl,
  };
}

function apiKey(): string {
  /*
   * Read at call time, not at module load, and named in the failure.
   *
   * The same posture `lib/geoapify/client.ts` takes: a missing key should fail
   * the one thing that needs it, with the variable's name in the message, rather
   * than throw during import and take down every page in the dashboard including
   * the ones that have nothing to do with billing.
   */
  if (!env.lemonApiKey) {
    throw new BillingError(
      "LEMON_API_KEY is not set, so checkout is unavailable. Add it to .env and restart.",
    );
  }

  return env.lemonApiKey;
}

async function send<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const key = apiKey();

  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      method: init.method,
      headers: {
        accept: MEDIA_TYPE,
        "content-type": MEDIA_TYPE,
        authorization: `Bearer ${key}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // The cause is logged rather than carried: the route turns a BillingError
    // into one sentence for the customer, and a DNS failure and a timeout read
    // the same to them but not to us.
    console.error("Lemon Squeezy is unreachable:", error);

    throw new BillingError("Couldn't reach the payment provider.");
  }

  if (!response.ok) {
    /*
     * The body is logged and never returned. It can name the store, the variant
     * and the key's own scopes, none of which is a customer's business — and the
     * customer's next action is the same whatever it says.
     */
    console.error(
      `Lemon Squeezy ${init.method} ${path} failed: ${String(response.status)} ${await response
        .text()
        .catch(() => "")}`,
    );

    throw new BillingError(
      "The payment provider refused that. Try again in a moment.",
      response.status,
    );
  }

  return (await response.json()) as T;
}

function variantFor(plan: PaidPlanId, cadence: BillingCadence): string {
  const variant = env.lemonVariants[plan][cadence];

  if (!variant) {
    throw new BillingError(
      `No ${cadence} variant is configured for the ${plan} plan. Set LEMON_VARIANT_${plan.toUpperCase()}_${cadence.toUpperCase()}.`,
    );
  }

  return variant;
}

async function createCheckout(request: CheckoutRequest): Promise<Checkout> {
  if (!env.lemonStoreId) {
    throw new BillingError(
      "LEMON_STORE_ID is not set, so checkout is unavailable. Add it to .env and restart.",
    );
  }

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: request.email,
          /*
           * Our own user id, round-tripped.
           *
           * This is the entire link between a payment and an account. It comes
           * back on every subscription webhook as `meta.custom_data`, and the
           * alternative — matching on the email address — would be unsound,
           * because the buyer can change that address at the checkout and would
           * then be granted somebody else's plan.
           */
          custom: { user_id: request.userId },
        },
        product_options: {
          redirect_url: `${env.appUrl}/account?checkout=done`,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: env.lemonStoreId } },
        variant: {
          data: {
            type: "variants",
            id: variantFor(request.plan, request.cadence),
          },
        },
      },
    },
  };

  const json = await send<{ data?: { attributes?: { url?: string } } }>(
    "/checkouts",
    { method: "POST", body },
  );

  const url = json.data?.attributes?.url;

  if (!url) {
    throw new BillingError("The payment provider returned no checkout link.");
  }

  return { url };
}

async function portalUrl(billingSubscriptionId: string): Promise<string | null> {
  if (!billingSubscriptionId) return null;

  try {
    const json = await send<{
      data?: { attributes?: { urls?: { customer_portal?: string } } };
    }>(`/subscriptions/${billingSubscriptionId}`, { method: "GET" });

    return json.data?.attributes?.urls?.customer_portal ?? null;
  } catch {
    /*
     * Null, not a throw. The account page draws a "manage subscription" link from
     * this, and a provider hiccup should cost the link, not the page that also
     * tells somebody which plan they are on and what they have used.
     */
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Webhooks
 * ------------------------------------------------------------------ */

/**
 * Whether this body really came from the provider.
 *
 * HMAC-SHA256 of the **raw** body against the signing secret, hex, compared in
 * constant time. Three things here are load bearing:
 *
 * - **Raw bytes, never a re-serialised object.** `JSON.parse` then
 *   `JSON.stringify` produces a different string for the same document — key
 *   order, number formatting, whitespace — and the digest would never match. It
 *   is why the route reads `request.text()` and parses afterwards.
 * - **Length is checked first.** `timingSafeEqual` *throws* on buffers of
 *   different lengths rather than returning false, so a malformed header would
 *   become a 500 instead of a 401. The same guard `app/api/cron/sheet-sync`'s
 *   `authorized()` uses, for the same reason.
 * - **An unset secret refuses everybody.** Not "skips verification" — an open
 *   endpoint that writes subscription rows is a free Pro plan for anyone who can
 *   POST, and defaulting to trust is how that ships by accident.
 */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  if (!env.lemonWebhookSecret || !signature) return false;

  const expected = Buffer.from(
    createHmac("sha256", env.lemonWebhookSecret).update(rawBody).digest("hex"),
    "utf8",
  );
  const actual = Buffer.from(signature, "utf8");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** The provider's own subscription statuses, as its documentation lists them. */
type LemonStatus =
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

/**
 * The provider's status, as one of ours.
 *
 * **The line that matters is `cancelled`.** It does not mean access has ended —
 * it means auto-renewal is off and the subscription runs to the end of the period
 * already paid for. Mapping it to `canceled` would take a customer's paid plan
 * away the moment they clicked cancel, which is both wrong and the kind of wrong
 * that arrives as a refund request. So it maps to `active`, and `currentPeriodEnd`
 * (from `ends_at`) is what actually closes it — either when `subscription_expired`
 * arrives, or, if that webhook is ever missed, when `getUserPlan` reads the date.
 *
 * `unpaid` is the end of the provider's dunning, not the start of it, so it is
 * `canceled` rather than `past_due`: retries have already been exhausted.
 *
 * An unrecognised status is `canceled`, which is the safe direction here. Guessing
 * `active` for a word we do not know would be giving the product away on the
 * strength of a typo.
 */
export function toStatus(status: string): SubscriptionStatus {
  const map: Record<LemonStatus, SubscriptionStatus> = {
    on_trial: "trialing",
    active: "active",
    paused: "paused",
    past_due: "past_due",
    unpaid: "canceled",
    cancelled: "active",
    expired: "canceled",
  };

  return map[status as LemonStatus] ?? "canceled";
}

/** Which of our plans a variant id is. Unknown ids are nobody's plan. */
export function planForVariant(variantId: string): PlanId | null {
  for (const plan of ["starter", "pro"] as const) {
    for (const cadence of ["monthly", "yearly"] as const) {
      if (env.lemonVariants[plan][cadence] === variantId) return plan;
    }
  }

  return null;
}

/**
 * A subscription object's attributes, as the seven lifecycle events send them.
 *
 * The four *payment* events do not send this — they send a subscription-invoice,
 * which carries `subscription_id` and an invoice `status` (`paid`, `void`,
 * `refunded`) and **no `variant_id` at all**. Reading one of those with this shape
 * would find no variant, match no plan, and log a configuration error on the most
 * routine event in the system. `subscriptionIdOf` is how those are handled
 * instead.
 */
type SubscriptionAttributes = {
  status?: string;
  customer_id?: number | string;
  variant_id?: number | string;
  renews_at?: string | null;
  ends_at?: string | null;
};

type WebhookBody = {
  meta?: { event_name?: string; custom_data?: { user_id?: unknown } };
  data?: {
    id?: string;
    attributes?: SubscriptionAttributes & { subscription_id?: number | string };
  };
};

export type WebhookEvent = {
  name: string;
  /** Null when the payload carries no id of ours to attach it to. */
  userId: string | null;
  /** Null for a payload that is not a subscription object — see `subscriptionIdOf`. */
  state: Omit<SubscriptionState, "userId"> | null;
};

/**
 * A subscription object's attributes, as our own state.
 *
 * Shared by the webhook reader and by `fetchSubscriptionState`, so a subscription
 * read from an event and the same subscription fetched from the API can never be
 * interpreted two different ways. That mattered enough to extract: the two paths
 * exist precisely so they can stand in for each other.
 */
function toState(
  attributes: SubscriptionAttributes,
  subscriptionId: string,
): Omit<SubscriptionState, "userId"> | null {
  const variantId =
    attributes.variant_id === undefined ? "" : String(attributes.variant_id);
  const plan = planForVariant(variantId);

  if (!plan) return null;

  return {
    // `planForVariant` answers from the configured variants alone, so this is
    // already one of ours — there is nothing left to validate here.
    plan,
    status: toStatus(attributes.status ?? ""),
    billingCustomerId:
      attributes.customer_id === undefined ? "" : String(attributes.customer_id),
    billingSubscriptionId: subscriptionId,
    /*
     * `ends_at` when the subscription is winding down, `renews_at` while it is
     * running. They are never both meaningful: a live subscription has a next
     * charge date, a cancelled one has a last day. Preferring `ends_at` is what
     * makes the `cancelled → active` mapping above safe — the plan stays until
     * exactly the day that was paid for.
     */
    currentPeriodEnd: attributes.ends_at ?? attributes.renews_at ?? null,
  };
}

/**
 * The subscription a payment event is about.
 *
 * The four payment events carry an invoice, not a subscription, so there is
 * nothing in them to write — but they are the events that fire when a renewal is
 * *charged*, and ignoring them entirely would rest the whole renewal path on the
 * assumption that `subscription_updated` always fires alongside. If it ever did
 * not, `currentPeriodEnd` would go stale and `getUserPlan` would quietly downgrade
 * somebody whose card had just been charged — the one failure direction that
 * check exists to avoid.
 *
 * So the route takes this id and asks the API what the subscription now says.
 * One extra call on a renewal, and the answer is authoritative rather than
 * inferred.
 */
export function subscriptionIdOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;

  const id = (body as WebhookBody).data?.attributes?.subscription_id;

  return id === undefined || id === null || id === "" ? null : String(id);
}

/** What the API says about a subscription right now. Null if it cannot be read. */
export async function fetchSubscriptionState(
  subscriptionId: string,
): Promise<Omit<SubscriptionState, "userId"> | null> {
  if (!subscriptionId) return null;

  const json = await send<{
    data?: { id?: string; attributes?: SubscriptionAttributes };
  }>(`/subscriptions/${subscriptionId}`, { method: "GET" });

  const attributes = json.data?.attributes;

  return attributes ? toState(attributes, String(json.data?.id ?? subscriptionId)) : null;
}

/**
 * A webhook payload, read into the one shape the route acts on.
 *
 * Pure and exported so it can be tested against real captured payloads without a
 * server, a database or a signature. Every field is read defensively — this is
 * third-party JSON arriving over the wire, and a missing key is a reason to
 * decline the event, never to throw inside a handler the provider will then retry
 * forever.
 */
export function readWebhook(body: unknown): WebhookEvent | null {
  /*
   * The object check is not redundant with the optional chaining below: `?.`
   * guards a *property* being nullish, not the thing it is read from, so
   * `payload.meta?.x` still throws when `payload` is null — and `typeof null` is
   * "object", so the check has to exclude it by name. A JSON body of `null` is a
   * perfectly legal thing for somebody to POST at this endpoint.
   */
  if (typeof body !== "object" || body === null) return null;

  const payload = body as WebhookBody;
  const name = payload.meta?.event_name;

  if (typeof name !== "string" || !name) return null;

  const rawUserId = payload.meta?.custom_data?.user_id;
  const userId = typeof rawUserId === "string" && rawUserId ? rawUserId : null;

  const attributes = payload.data?.attributes;

  if (!attributes) return { name, userId, state: null };

  return {
    name,
    userId,
    state: toState(attributes, payload.data?.id ? String(payload.data.id) : ""),
  };
}
