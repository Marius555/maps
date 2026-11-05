import { APP_BRIDGE_SRC } from "@/lib/shopify/pages";

/**
 * Shopify App Bridge, for a dashboard page shown inside the Shopify admin
 * (docs/notes/shopify.md). Rendered by the dashboard layout only when the
 * request came with a Shopify ID token, so the web app never loads it.
 *
 * - **Synchronous, on purpose.** App Bridge patches `fetch` to attach a fresh
 *   ID token to every same-origin request — our REST calls and the router's own
 *   flight requests alike — and that patch has to be in place before any of
 *   them run. A sync script in the layout is parsed before the page content and
 *   the hydration that starts those requests.
 * - `shopify-api-key` is the client id, which App Bridge reads from the page.
 *   React hoists the `<meta>` into the head.
 * - The nav menu is the admin's own left-hand links for this app.
 * - **In development only, App Bridge logs Web Vitals to the console** —
 *   `shopify-debug`, Shopify's documented switch. LCP, CLS and INP inside the
 *   admin are what Built for Shopify grades (2.5s, 0.1, 200ms at the 75th
 *   percentile), and these lines are the values as Shopify records them, which
 *   our own tools measure differently. Production's numbers are in the Dev
 *   Dashboard (docs/notes/shopify.md, "Performance").
 */
export function ShopifyAppBridge({ clientId }: { clientId: string }) {
  return (
    <>
      <meta name="shopify-api-key" content={clientId} />
      {process.env.NODE_ENV !== "production" ? (
        <meta name="shopify-debug" content="web-vitals" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run before app code; see above */}
      <script src={APP_BRIDGE_SRC} />
      {/* Not links on our page: App Bridge reads these anchors as the
          admin's own left-hand menu for this app, and they are never rendered.

          Wrapped so React Aria's `inert` lands on the wrapper. Every HeroUI
          dialog, drawer and overlay marks everything outside itself inert
          (`ariaHideOutside`), and on `<ui-nav-menu>` itself App Bridge reports
          that as "Unexpected attributes on <ui-nav-menu>: inert". */}
      <div>
        <ui-nav-menu>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- App Bridge configuration, see above */}
          <a href="/maps" rel="home">
            Maps
          </a>
          <a href="/settings">Settings</a>
        </ui-nav-menu>
      </div>
    </>
  );
}
