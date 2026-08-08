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
  };
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
