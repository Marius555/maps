/**
 * Rendered previews, kept in the browser so a returning owner's maps list draws
 * every card at once instead of re-rendering fifteen maps.
*
 * IndexedDB rather than localStorage because the value is an image: a Blob
 * stores as bytes, where localStorage would need a base64 string a third larger
 * again, and fifteen of those would crowd its few-megabyte quota.
 *
 * Every call swallows its own failure. A private window, blocked site data or a
 * full disk make the store unusable, and the right answer then is a preview that
 * is rendered on every visit — never a card that fails to draw. Nothing here is
 * the only copy of anything.
 */

const DB_NAME = "map-previews";
const STORE = "previews";

export type CachedPreview = {
  /** `previewKey` at render time — see ./version.ts. */
  key: string;
  blob: Blob;
};

let opening: Promise<IDBDatabase | null> | null = null;

function database(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return opening;
}

/** One transaction, resolved when it commits. Null when there is no store. */
async function transact<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | null> {
  const db = await database();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));

      transaction.oncomplete = () => resolve(request ? request.result : null);
      transaction.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readPreview(mapId: string): Promise<CachedPreview | null> {
  const value = await transact<CachedPreview | undefined>("readonly", (store) =>
    store.get(mapId),
  );

  return value && typeof value.key === "string" && value.blob instanceof Blob
    ? value
    : null;
}

export async function writePreview(mapId: string, preview: CachedPreview): Promise<void> {
  await transact("readwrite", (store) => {
    store.put(preview, mapId);
  });
}

/** Drop the pictures of maps that no longer exist. */
export async function prunePreviews(keep: ReadonlySet<string>): Promise<void> {
  const keys = await transact<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  const stale = (keys ?? []).filter(
    (key): key is string => typeof key === "string" && !keep.has(key),
  );

  if (stale.length === 0) return;

  await transact("readwrite", (store) => {
    for (const key of stale) store.delete(key);
  });
}
