import type { MapSnapshot } from "@/packages/shared/snapshot";

/**
 * Fetching the published snapshot.
 *
 * This is the only network request the embed makes for data — tiles aside,
 * nothing else is loaded, and nothing metered sits in the visitor's path
 * (CLAUDE.md §2).
 *
 * The retry exists for one specific reason: publishing replaces the live file by
 * deleting and recreating it, because Appwrite Storage has no atomic overwrite.
 * That leaves a window, one upload long, where the URL 404s. A visitor who lands
 * in it should see a map a moment later, not a blank box.
 */

const SUPPORTED_VERSION = 1;
const RETRY_DELAY_MS = 1200;

export async function fetchSnapshot(url: string): Promise<MapSnapshot> {
  try {
    return await load(url);
  } catch (error) {
    await delay(RETRY_DELAY_MS);
    // One retry only. If the second attempt fails, the map is genuinely gone
    // and retrying harder would just hammer storage from every visitor.
    return load(url).catch(() => {
      throw error;
    });
  }
}

async function load(url: string): Promise<MapSnapshot> {
  const response = await fetch(url, { credentials: "omit" });

  if (!response.ok) {
    throw new Error(`Snapshot request failed with ${response.status}`);
  }

  const snapshot = (await response.json()) as MapSnapshot;

  if (snapshot?.version !== SUPPORTED_VERSION) {
    // Forward compatibility: an old embed cached on a customer's site must not
    // try to render a format it doesn't know.
    throw new Error(
      `Snapshot version ${String(snapshot?.version)} is not supported by this embed.`,
    );
  }

  return snapshot;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
