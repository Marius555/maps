import "server-only";

import { env } from "@/lib/env";

/**
 * The HTTP plumbing every Lemon Squeezy call shares: the key, the JSON:API
 * headers, the timeout and the one error type. Split out of `lemon.ts` when
 * discounts arrived (`lemon-discounts.ts`), so a second adapter file did not
 * have to copy `send`. Nothing outside `lib/billing/` imports it.
 */

export const API = "https://api.lemonsqueezy.com/v1";

/** JSON:API, which the provider requires on both headers rather than `application/json`. */
const MEDIA_TYPE = "application/vnd.api+json";

/**
 * Longer than a page would wait, shorter than the platform's own request cap.
 *
 * Appwrite Sites cuts every request off at 30 seconds (CLAUDE.md §12), so a
 * checkout that hangs must fail with a message rather than be killed without one.
 */
const TIMEOUT_MS = 10_000;

/** One attribute the provider refused, and what it said about it. */
export type RefusedField = { attribute: string; detail: string };

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /**
     * The request attributes the provider named in a refusal (`code`,
     * `expires_at`…) with its own sentence for each, read from its JSON:API
     * `source.pointer`s. Only the operator console reads them, to put a refusal
     * under the field it is about; a customer is never shown the provider's
     * own words.
     */
    readonly fields: readonly RefusedField[] = [],
  ) {
    super(message);
    this.name = "BillingError";
  }
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

/**
 * The provider's ids are integers, and anything else is refused before it
 * reaches a URL.
 *
 * Ids come from our own rows or from the operator console — but a value like
 * `../customers/1` spliced into `/subscriptions/${id}` would have sent the
 * store's API key to whichever endpoint it named. A 404 is the answer a bad id
 * deserves, so that is the status it carries.
 */
export function assertNumericId(id: string, what = "id"): string {
  if (!/^\d{1,20}$/.test(id)) {
    throw new BillingError(`That ${what} isn't one the payment provider issued.`, 404);
  }

  return id;
}

/**
 * What a JSON:API error body points at, e.g. `/data/attributes/code` → `code`,
 * with the provider's sentence about it. Exported for the tests.
 */
export function refusedFields(body: string): RefusedField[] {
  try {
    const json = JSON.parse(body) as {
      errors?: { detail?: unknown; source?: { pointer?: unknown } }[];
    };

    return (json.errors ?? []).flatMap((error) => {
      const pointer = error.source?.pointer;
      const match = typeof pointer === "string" ? /\/attributes\/(\w+)$/.exec(pointer) : null;
      const detail = typeof error.detail === "string" ? error.detail : "";

      return match ? [{ attribute: match[1], detail }] : [];
    });
  } catch {
    return [];
  }
}

export async function send<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
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
    const text = await response.text().catch(() => "");

    console.error(
      `Lemon Squeezy ${init.method} ${path} failed: ${String(response.status)} ${text}`,
    );

    throw new BillingError(
      "The payment provider refused that. Try again in a moment.",
      response.status,
      refusedFields(text),
    );
  }

  // A DELETE of a discount answers 204 with no body.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
