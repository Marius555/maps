import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Where a half-finished import lives while the browser is doing it.
 *
 * The wizard used to hold everything in memory and `reset` on unmount, so a
 * reload, a closed tab, a crashed renderer or a mis-clicked back button threw
 * away the whole run. On a small file that is an annoyance. On a three-thousand
 * row file it is ten minutes of a metered upstream, spent and unrecoverable, and
 * the only way back is to import the same file again and spend it twice.
 *
 * **IndexedDB rather than `localStorage`, for two reasons and not one.** Size is
 * the obvious one: three thousand rows plus three thousand drafts is megabytes
 * and `localStorage` caps at about five, whole-origin. The other matters more —
 * `localStorage` is synchronous *and* stores strings, so every write would be a
 * multi-megabyte `JSON.stringify` blocking the main thread. IndexedDB takes a
 * structured clone of the object as it is, off the critical path, with no
 * serialisation step at all. That is why this implements `PersistStorage`
 * directly rather than wrapping `createJSONStorage`.
 *
 * **Writes are debounced, and that is load-bearing.** `patchDraft` fires once
 * per resolved address, so a three-thousand-row geocode is three thousand state
 * changes; persisting each one would clone the entire run three thousand times.
 * Coalescing to one write every `WRITE_DEBOUNCE_MS` makes it about one clone a
 * second and costs, at worst, the last second and a half of progress — against
 * losing all of it, which is the thing this file exists to stop.
 */

const DB_NAME = "map-import";
const DB_VERSION = 1;
const STORE = "runs";

/**
 * Long enough to coalesce a burst of row patches, short enough that the tail
 * lost to a hard crash is a couple of chunks rather than a couple of minutes.
 * An orderly departure loses nothing — see `flush` and the `pagehide` handler.
 */
const WRITE_DEBOUNCE_MS = 1500;

/**
 * A run older than this is discarded rather than offered.
 *
 * Addresses do not go stale in a day, but intent does: coming back a week later
 * and being dropped into the middle of a file you have forgotten importing is
 * worse than starting again, and the file itself is long gone from the page.
 */
export const RUN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!isAvailable()) return Promise.resolve(null);

  dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };

    // Resolved to null rather than rejected on every failure path. A browser in
    // private mode, or one with site data blocked, must leave the import working
    // exactly as it did before any of this existed — losing the ability to
    // resume, never the ability to import.
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);

        try {
          const request = action(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          // A quota failure surfaces here on some browsers rather than on the
          // request. Same answer: the import carries on, unresumable.
          resolve(null);
        }
      }),
  );
}

/**
 * The pending write, held as the *latest* value rather than a queue: an import
 * only ever wants its most recent state on disk, and writing the intermediate
 * ones would be the cost this debounce exists to avoid.
 */
let pending: { name: string; value: unknown } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  if (!pending) return;

  const { name, value } = pending;
  pending = null;
  void run("readwrite", (store) => store.put(value, name));
}

/*
 * `pagehide`, not `beforeunload`: `beforeunload` is unreliable on mobile and
 * makes the page ineligible for the back/forward cache, and this listener must
 * not cost every dashboard page a bfcache entry. `pagehide` fires on the way to
 * the cache as well as on a real unload, which is exactly the pair of moments a
 * pending write has to be on disk by.
 */
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function createImportStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) =>
      (await run<StorageValue<S>>("readonly", (store) =>
        store.get(name),
      )) as StorageValue<S> | null,

    setItem: (name, value) => {
      pending = { name, value };

      if (timer === null) timer = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },

    removeItem: (name) => {
      // Cancel first: a delete racing a queued write is how a "start over" ends
      // up putting the discarded run straight back.
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;

      void run("readwrite", (store) => store.delete(name));
    },
  };
}
