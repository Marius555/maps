/**
 * The Admin API access scopes this app asks for, and how a granted list is
 * read (docs/notes/shopify.md, "Scopes").
 *
 * **Every scope here is optional** — `optional_scopes` in
 * distribution/shopify/shopify.app.toml, with `scopes = ""` — so installing
 * asks for nothing, and a merchant is asked only when they press the button
 * that needs one (App Bridge's Scopes API). Pure and dependency-free: the
 * browser imports the names, and the rule is tested without Shopify.
 */

/** Reading the shop's own locations, for "Import from Shopify". */
export const LOCATIONS_SCOPE = "read_locations";

/**
 * Whether a granted scope list (Shopify's comma-separated form) covers every
 * one of `required`. A `write_x` grant implies `read_x`, as Shopify's own
 * access rules do.
 */
export function grantsScopes(scope: string, required: readonly string[]): boolean {
  const granted = new Set(
    scope
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  return required.every(
    (needed) => granted.has(needed) || (needed.startsWith("read_") && granted.has(`write_${needed.slice(5)}`)),
  );
}
