/** The only shape of "user" the app knows about. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /**
   * Present only when the request came from inside the Shopify admin, signed
   * with a Shopify ID token rather than our session cookie (lib/auth/shopify-user.ts).
   * `id` is then the shop's workspace. Absent is the web app, exactly as before.
   */
  shopify?: ShopifySessionInfo;
};

export type ShopifySessionInfo = {
  /** `demo-shop.myshopify.com` */
  shop: string;
  /** `demo-shop` — the shop's handle in `admin.shopify.com/store/<handle>` URLs. */
  storeHandle: string;
  /**
   * Shopify's own plan page for this app, where a shop upgrades — Shopify
   * bills it (App Store requirement 1.2.1), never our checkout. Opened in the
   * top window: it is an admin page, not ours.
   */
  pricingUrl: string;
};
