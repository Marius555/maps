/**
 * A shop's `*.myshopify.com` domain: the one identifier Shopify gives a store
 * that never changes, and so the key everything Shopify-side is filed under.
 *
 * Pure and dependency-free on purpose — `proxy.ts` calls it, and the proxy may
 * make no network calls and should pull in as little as possible.
 *
 * The pattern is Shopify's own (`sanitizeShop` in `@shopify/shopify-api`),
 * lower-cased. Anything else — a custom domain, `admin.shopify.com/store/x`, a
 * value with a path or a port — is refused rather than normalised: every place
 * this is read from is Shopify telling us the domain, so a value in another
 * shape is not Shopify talking.
 */

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9_-]*\.myshopify\.com$/;

const SUFFIX = ".myshopify.com";

/** The shop domain, lower-cased, or null when the value is not one. */
export function parseShopDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const shop = value.trim().toLowerCase();
  if (shop.length > 255 || !SHOP_DOMAIN.test(shop)) return null;

  return shop;
}

/**
 * The store's handle in the admin's own URLs —
 * `admin.shopify.com/store/<handle>/…` — which is the domain's first label.
 */
export function storeHandle(shop: string): string {
  return shop.endsWith(SUFFIX) ? shop.slice(0, -SUFFIX.length) : shop;
}

/**
 * The `frame-ancestors` a page embedded in this shop's admin must send, and the
 * only origins that may frame it. Shopify's own value, from the React Router
 * adapter: the shop itself (the legacy admin), the unified admin, and the three
 * hosts Shopify uses internally for its own development stores.
 */
export function frameAncestorsFor(shop: string): string {
  return [
    `https://${shop}`,
    "https://admin.shopify.com",
    "https://*.spin.dev",
    "https://admin.myshopify.io",
    "https://admin.shop.dev",
  ].join(" ");
}
