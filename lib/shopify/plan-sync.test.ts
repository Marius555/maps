import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The hourly sweep's one ordering rule: a Partner API failure (an outage, a
 * revoked token, a missing permission) must not stop the erasure pass, which
 * answers Shopify's shop/redact webhook.
 */

const recentSubscriptionEvents = vi.fn();
const listShopsDueForRedaction = vi.fn();
const deleteShop = vi.fn();
const runDeletionStep = vi.fn();

vi.mock("./partner-api", () => ({
  partnerApiConfigured: () => true,
  recentSubscriptionEvents,
  fetchActiveSubscription: vi.fn(),
}));
vi.mock("@/lib/repositories/shopify-shops.repository", () => ({
  listShopsDueForRedaction,
  deleteShop,
  findShop: vi.fn(),
  findShopByWorkspace: vi.fn(),
  updateShop: vi.fn(),
}));
vi.mock("@/lib/repositories/subscriptions.repository", () => ({
  getSubscription: vi.fn(),
  listShopifySubscriptionsEndingBefore: vi.fn(async () => []),
  upsertSubscription: vi.fn(),
}));
vi.mock("@/lib/account-deletion/step", () => ({ runDeletionStep }));
vi.mock("@/lib/account-deletion/store", () => ({ deletionStoreFor: vi.fn(() => ({})) }));
vi.mock("@/lib/repositories/context", () => ({ ownerContext: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/identity-cache", () => ({ forgetUser: vi.fn() }));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn() }));

const { runShopifySweepStep } = await import("./plan-sync");

describe("runShopifySweepStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("still erases shops when the Partner API fails", async () => {
    recentSubscriptionEvents.mockRejectedValue(new Error("The Partner API refused a query: App not found"));
    listShopsDueForRedaction.mockResolvedValue([{ id: "row1", shop: "gone.myshopify.com", workspaceId: "w1" }]);
    runDeletionStep.mockResolvedValue({ done: true });

    const step = await runShopifySweepStep({ deadline: Date.now() + 60_000 });

    expect(deleteShop).toHaveBeenCalledWith("row1");
    expect(step).toEqual({ more: false, refreshed: 0, redacted: 1, failed: 1 });
  });
});
