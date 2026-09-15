/**
 * Surviving a chunk that wasn't there.
 *
 * `next/dynamic` is `React.lazy(() => opts.loader().then(convertModule))`, and
 * React's `lazy` caches a *rejection* permanently: once the payload settles as
 * rejected, every later render rethrows the same error. So a single failed chunk
 * fetch parks the user on `app/(dashboard)/error.tsx` forever, and its "Try
 * again" button is dead — `reset()` re-renders straight back into the rejected
 * payload. Only a full page reload recovers.
 *
 * Two things make that fetch fail for reasons that are nobody's bug:
 *
 * - **A cold dev start.** Turbopack compiles on demand, so a tab already sitting
 *   on `/maps/[id]` when `next dev` starts asks for a chunk that has not been
 *   emitted yet and gets a 404. `/maps/[id]` pulls in MapLibre and takes tens of
 *   seconds to compile from an empty cache.
 * - **A deploy.** An open dashboard tab holds the previous build's chunk URLs,
 *   and after a deploy those are genuinely gone. No amount of retrying helps
 *   there; only reloading onto the new build does.
 *
 * Turbopack's own runtime already retries, and it is worth knowing exactly how
 * little: `CHUNK_LOAD_RETRY_MAX_ATTEMPTS = 1`, 200ms plus up to 400ms of jitter.
 * One attempt, under 600ms later. Against a cold compile that always lands
 * inside the same dead window, which is why by the time we see the error the
 * runtime's own retry has already been spent.
 *
 * What makes retrying here work at all is that the permanent cache is React's,
 * not Turbopack's: `rejectChunkResolver` drops the failed resolver from
 * `chunkResolvers` ("a later request for the same chunk should try again"), so a
 * fresh `import()` mints a new resolver and really does re-fetch.
 */

/** Attempts in total, the first one included. */
const MAX_ATTEMPTS = 2;

/**
 * The wait before the second attempt, and why it is this short.
 *
 * Measured in Chrome against a forced 404 on the maplibre CSS chunk: across two
 * further `import()` calls Turbopack inserted **no** new link and made **no**
 * new request, and the page recovered 2408ms after the failure — the retry
 * budget of the day, 600 + 1800, to the millisecond. Turbopack caches a dynamic
 * import's rejection for the life of the document, so retrying a chunk that has
 * already failed in this document cannot re-fetch it. The reload is what
 * recovers it.
 *
 * So the backoff is not a second chance for CSS; it is only worth the one short
 * attempt that costs little if the rejection ever is retryable, and every
 * millisecond beyond that is a skeleton on screen delaying the reload that
 * actually works.
 */
const RETRY_DELAYS_MS = [400];

/**
 * Set for the rest of the tab's life once we have reloaded for this, so a chunk
 * that is still missing afterwards shows an error instead of reloading forever.
 */
const RELOADED_KEY = "lm-chunk-reloaded";

/**
 * Wraps a `() => import(...)` so a transient chunk failure does not become a
 * permanent one. Hand the result to `dynamic()` in place of the bare loader.
 */
export function retryImport<T>(load: () => Promise<T>): () => Promise<T> {
  return async function loadWithRetry(): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const loaded = await load();

        /*
         * Cleared on success, not merely on reload. A dashboard tab left open
         * for a week outlives several deploys, and each one deserves its own
         * reload rather than being refused because an earlier one used it up.
         */
        forget();

        return loaded;
      } catch (error) {
        /*
         * The gate that keeps this from being a debugging nightmare.
         *
         * A module-evaluation error — a real bug on the first line of
         * `map-canvas-impl` — is not a missing chunk, and retrying it wastes
         * three seconds before reloading the page into the identical crash.
         * Anything that is not the runtime's own `ChunkLoadError` surfaces
         * immediately, untouched.
         */
        if (!isChunkLoadError(error)) throw error;

        if (attempt + 1 >= MAX_ATTEMPTS) {
          reloadOnce();
          throw error;
        }

        await delay(RETRY_DELAYS_MS[attempt] ?? 0);
      }
    }
  };
}

/** The name Turbopack's runtime puts on a chunk it could not fetch. */
function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && error.name === "ChunkLoadError";
}

/**
 * Reloads, at most once per tab.
 *
 * Fails closed: if `sessionStorage` is unreachable we cannot tell a first
 * attempt from a hundredth, and a reload loop is far worse than an error screen,
 * so we do nothing. Storage throws outright in some privacy modes — the same
 * reason `components/providers/theme-script.tsx` wraps its own read.
 */
function reloadOnce(): void {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return;
    sessionStorage.setItem(RELOADED_KEY, "1");
  } catch {
    return;
  }

  /*
   * The caller still throws after this. Navigation is not instant, so the error
   * boundary may show for a beat before the page goes — which is the right way
   * round: if the reload never happens, the failure stays visible rather than
   * hanging on a skeleton that will never resolve.
   */
  location.reload();
}

function forget(): void {
  try {
    sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // Nothing to clean up if we could never write it in the first place.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
