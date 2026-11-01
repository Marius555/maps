import "server-only";

import type { ShopifyActiveSubscription } from "@/lib/billing/shopify-pricing";
import { env } from "@/lib/env";
import { ShopifyApiError } from "./admin-api";

/**
 * The Partner API: where Shopify App Pricing reports what a shop is subscribed
 * to (docs/notes/shopify.md, "Billing"). One organisation-level token, from a
 * Partner API client in the Partner Dashboard; nothing here is per shop.
 *
 * Only ever called by the dashboard — the App Home and the hourly sweep —
 * never in a storefront visitor's path (§2).
 */

const PARTNER_API_VERSION = "2026-10";
const REQUEST_TIMEOUT_MS = 10_000;

export function partnerApiConfigured(): boolean {
  return Boolean(env.shopifyPartnerApiToken && env.shopifyPartnerId && env.shopifyAppId);
}

/** `gid://shopify/App/<id>`, accepting either form in the env var. */
function appGid(): string {
  const id = env.shopifyAppId.trim();
  return id.startsWith("gid://") ? id : `gid://shopify/App/${id}`;
}

async function partnerGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(
    `https://partners.shopify.com/${encodeURIComponent(env.shopifyPartnerId)}/api/${PARTNER_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-shopify-access-token": env.shopifyPartnerApiToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new ShopifyApiError(`The Partner API answered ${response.status}.`, response.status);
  }

  const body = (await response.json()) as { data?: T; errors?: { message?: string }[] };
  if (body.errors?.length || !body.data) {
    throw new ShopifyApiError(
      `The Partner API refused a query: ${body.errors?.[0]?.message ?? "no data"}`,
      502,
    );
  }

  return body.data;
}

/** What one shop is subscribed to right now, or null for nothing. */
export async function fetchActiveSubscription(
  shopGid: string,
): Promise<ShopifyActiveSubscription | null> {
  const data = await partnerGraphql<{ activeSubscription: ShopifyActiveSubscription | null }>(
    `query PinglideActiveSubscription($appId: ID!, $shopId: ID!) {
      activeSubscription(appId: $appId, shopId: $shopId) {
        billingPeriod
        cancelAtEndOfCycle
        trialEndsAt
        currentBillingCycle { startTime endTime }
        items { handle }
      }
    }`,
    { appId: appGid(), shopId: shopGid },
  );

  return data.activeSubscription;
}

/** The events that change what a shop is entitled to. */
const SUBSCRIPTION_EVENTS = [
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "SUBSCRIPTION_CANCELLATION_SCHEDULED",
  "SUBSCRIPTION_CANCELED",
  "SUBSCRIPTION_FROZEN",
  "SUBSCRIPTION_UNFROZEN",
] as const;

export type SubscriptionEvent = {
  shopGid: string;
  shop: string;
  eventType: (typeof SUBSCRIPTION_EVENTS)[number] | string;
  occurredAt: string;
};

/**
 * Subscription events since `since`, newest first, one page (250 is the
 * Partner API's own ceiling — far more plan changes than an hour holds).
 */
export async function recentSubscriptionEvents(since: Date): Promise<SubscriptionEvent[]> {
  const data = await partnerGraphql<{
    events: {
      edges: {
        node: {
          eventType: string;
          occurredAt: string;
          shop: { id: string; myshopifyDomain: string } | null;
        };
      }[];
    };
  }>(
    `query PinglideSubscriptionEvents($appId: ID!, $since: DateTime!, $types: [EventType!]) {
      events(
        filter: { subjectId: $appId, eventTypes: $types, occurredAtMin: $since }
        first: 250
      ) {
        edges { node { eventType occurredAt shop { id myshopifyDomain } } }
      }
    }`,
    { appId: appGid(), since: since.toISOString(), types: SUBSCRIPTION_EVENTS },
  );

  return data.events.edges.flatMap(({ node }) =>
    node.shop
      ? [
          {
            shopGid: node.shop.id,
            shop: node.shop.myshopifyDomain.toLowerCase(),
            eventType: node.eventType,
            occurredAt: node.occurredAt,
          },
        ]
      : [],
  );
}
