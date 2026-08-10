/**
 * Reading a map's configuration off its own script tag.
 *
 * `document.currentScript` is null in an ES module, and MapLibre v6 is ESM only,
 * so the boot code finds script tags by attribute instead. That turns out to be
 * the better design anyway: several maps on one page each get their own tag, and
 * nothing depends on execution order.
 */

export const DEFAULT_HEIGHT = 520;
const MIN_HEIGHT = 160;

export type EmbedConfig = {
  snapshotUrl: string;
  height: number;
  /** Optional CSS selector for an existing element to render into. */
  target: string | null;
  /**
   * Build the map immediately instead of waiting for it to be scrolled near.
   *
   * Opt-in, because deferring is the better default: a map three screens down a
   * page costs the visitor a WebGL context and a screenful of tiles they may
   * never look at. Set `data-eager` when the map is above the fold and the
   * fractional delay matters more than the bytes.
   */
  eager: boolean;
};

export function readConfig(script: HTMLScriptElement): EmbedConfig | null {
  const snapshotUrl = script.dataset.snapshot?.trim();

  if (!snapshotUrl) {
    warn("is missing its data-snapshot attribute, so there is nothing to load.");
    return null;
  }

  return {
    snapshotUrl,
    height: readHeight(script.dataset.height),
    target: script.dataset.target?.trim() || null,
    // Bare `data-eager` is the common way to write it, so presence is enough —
    // but `data-eager="false"` has to mean what it says.
    eager:
      script.dataset.eager !== undefined && script.dataset.eager !== "false",
  };
}

/**
 * The location to open on, from the host page's own URL: `?place=<id>`.
 *
 * Read from `window.location` rather than an attribute, which is only possible
 * because the embed is a module script on the page itself and not an iframe —
 * so a customer can link to one of their stockists with a normal URL on their
 * own domain, and it survives being copied out of the address bar.
 *
 * Read-only, deliberately. Writing back to a stranger's address bar when a popup
 * opens would rewrite history on a page we are a guest on.
 *
 * An id belonging to a different map on the same page simply won't be found in
 * this snapshot, which is what makes several maps per page work with no config.
 */
export function readFocusPlaceId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("place");
  } catch {
    return null;
  }
}

/**
 * Resolves once the element is near enough to the viewport to be worth building
 * a map for — or immediately when lazy loading is off or unavailable.
 *
 * The margin means the map is normally ready by the time it is actually looked
 * at, so this reads as a faster page rather than a slower map.
 */
export function whenVisible(
  element: HTMLElement,
  eager: boolean,
): Promise<void> {
  if (eager || typeof IntersectionObserver === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        observer.disconnect();
        resolve();
      },
      { rootMargin: "200px" },
    );

    observer.observe(element);
  });
}

function readHeight(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT;

  // A map a few pixels tall is a broken page, not a preference.
  return Math.max(parsed, MIN_HEIGHT);
}

/**
 * Problems are reported to the console and nowhere else. This code runs on
 * someone else's website — it must never paint an error message into their page.
 */
export function warn(message: string): void {
  console.warn(`[map embed] ${message}`);
}
