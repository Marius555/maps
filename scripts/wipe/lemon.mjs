/**
 * The payment provider's half of the wipe. Deleting a `subscriptions` row does
 * not stop a card being charged, so a live subscription is cancelled at the
 * provider first — the same DELETE as `cancelSubscription` in
 * lib/billing/lemon.ts. Discount codes live only at the provider
 * (docs/notes/billing.md, "Discounts"), so wiping them is a DELETE there too.
 */

const API = "https://api.lemonsqueezy.com/v1";
const MEDIA_TYPE = "application/vnd.api+json";

/** The key decides test or live mode, as everywhere else (CLAUDE.md, Environment). */
export function lemonKey() {
  return process.env.LEMON_API_KEY || process.env.LEMON_TEST_API_KEY || "";
}

async function send(path, method = "GET") {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { accept: MEDIA_TYPE, "content-type": MEDIA_TYPE, authorization: `Bearer ${lemonKey()}` },
    signal: AbortSignal.timeout(15_000),
  });

  // The body is never printed: it can carry customer details.
  if (!response.ok) {
    const error = new Error(`${method} ${path.split("?")[0]} answered HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

/** The provider's status, or null when it has no such subscription. */
export async function subscriptionStatus(subscriptionId) {
  try {
    const json = await send(`/subscriptions/${subscriptionId}`);
    return json?.data?.attributes?.status ?? null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function cancelSubscription(subscriptionId) {
  await send(`/subscriptions/${subscriptionId}`, "DELETE");
}

export async function listDiscounts(storeId) {
  const discounts = [];
  let page = 1;

  for (;;) {
    const query = new URLSearchParams({
      "filter[store_id]": storeId,
      "page[size]": "100",
      "page[number]": String(page),
    });
    const json = await send(`/discounts?${query}`);

    for (const resource of json?.data ?? []) {
      discounts.push({ id: resource.id, code: resource.attributes?.code ?? "?" });
    }

    const lastPage = json?.meta?.page?.lastPage ?? 1;
    if (page >= lastPage) return discounts;
    page += 1;
  }
}

export async function deleteDiscount(discountId) {
  await send(`/discounts/${discountId}`, "DELETE");
}
