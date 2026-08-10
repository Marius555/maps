/**
 * The snippet a customer pastes into their own site.
 *
 * One `<script>` tag and nothing else, because "paste this line into your page"
 * is the whole promise (CLAUDE.md §1). The embed inserts its own container next
 * to the script element, so there is no second line telling the customer to add
 * a div and match an id.
 *
 * `data-snapshot` is the live snapshot URL, which is stable across republishes —
 * see lib/snapshot/storage.ts. That is what makes this snippet a paste-once
 * thing rather than something to update on every publish.
 */

/** Where the built embed bundle is served from in development. */
export const EMBED_SCRIPT_PATH = "/embed/map.js";

export const DEFAULT_EMBED_HEIGHT = 520;

export function embedScriptUrl(origin: string): string {
  // Set this to the CDN origin in production. Falling back to the dashboard's
  // own origin keeps development and self-hosting working with no config.
  return process.env.NEXT_PUBLIC_EMBED_SCRIPT_URL || `${origin}${EMBED_SCRIPT_PATH}`;
}

export function embedSnippet({
  scriptUrl,
  snapshotUrl,
  height = DEFAULT_EMBED_HEIGHT,
  target,
  eager = false,
}: {
  scriptUrl: string;
  snapshotUrl: string;
  height?: number;
  /** CSS selector to render into, instead of inserting a container in place. */
  target?: string;
  /** Skip lazy loading. Only the in-dashboard preview needs this. */
  eager?: boolean;
}): string {
  // type="module" is required, not stylistic: MapLibre v6 ships ESM only, so the
  // bundle is a module. Modules are deferred by default, hence no `async`.
  return (
    `<script type="module" src="${escapeAttribute(scriptUrl)}"` +
    ` data-snapshot="${escapeAttribute(snapshotUrl)}"` +
    (target ? ` data-target="${escapeAttribute(target)}"` : "") +
    (eager ? " data-eager" : "") +
    ` data-height="${height}"></script>`
  );
}

/**
 * These URLs are ours, not user input, but the snippet is copied into someone
 * else's HTML — quoting it correctly is the difference between a working embed
 * and a broken page.
 */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
