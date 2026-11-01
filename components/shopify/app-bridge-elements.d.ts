import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * App Bridge's custom elements, as far as this app uses them
 * (components/shopify/app-bridge.tsx). They exist only once App Bridge has
 * loaded, inside the Shopify admin; anywhere else they are inert unknown tags.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "ui-nav-menu": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
