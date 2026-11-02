import "server-only";

import { isPostHogEnabled, posthogHost, posthogProjectToken } from "./config";

/**
 * A product-analytics event sent from the server, for the moments no page of
 * ours is on screen to send it: a Shopify shop's install and its first paid
 * plan both happen inside the App Home's redirect (lib/shopify/funnel.ts).
 *
 * The same project and the same person as the browser's events — `distinctId`
 * is the account id the dashboard's `identifyUser` uses — so PostHog joins
 * them. Off whenever the browser's is off (`./config.ts`), so development is
 * silent. Never the embed and never per visitor (§2): this is a merchant
 * opening the dashboard.
 */

/** PostHog's single-event capture endpoint, on the ingestion host. */
const CAPTURE_PATH = "/i/v0/e/";

/** Long enough for a healthy round trip, short enough not to hold an install up. */
const TIMEOUT_MS = 1500;

export type ServerEventProperties = Record<string, unknown> & {
  /** Person properties, set on the person this event belongs to. */
  $set?: Record<string, unknown>;
};

/** The request body PostHog's capture API takes. Pure, so its shape is tested. */
export function serverEventBody(
  apiKey: string,
  distinctId: string,
  event: string,
  properties: ServerEventProperties = {},
): { api_key: string; event: string; distinct_id: string; properties: ServerEventProperties } {
  return { api_key: apiKey, event, distinct_id: distinctId, properties };
}

/**
 * Send one event. Awaited by callers, but **never throws**: analytics must not
 * be what breaks an install or a plan change, so a failure is a warning.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: ServerEventProperties,
): Promise<void> {
  if (!isPostHogEnabled || !posthogProjectToken || !posthogHost) return;

  try {
    const response = await fetch(new URL(CAPTURE_PATH, posthogHost), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(serverEventBody(posthogProjectToken, distinctId, event, properties)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.warn(`[posthog] ${event} was refused with ${response.status}.`);
  } catch (error) {
    console.warn(`[posthog] ${event} was not sent:`, error);
  }
}
