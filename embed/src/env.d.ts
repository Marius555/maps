/// <reference types="vite/client" />

/**
 * The embed inlines its CSS into the JS bundle so a customer's page makes one
 * request for our code — a separate stylesheet would need its own CORS-correct
 * URL on every site. These declarations are what let `tsc --noEmit` (run from
 * the repo root over every .ts file) understand Vite's `?inline` suffix.
 */

declare module "*.css?inline" {
  const css: string;
  export default css;
}
