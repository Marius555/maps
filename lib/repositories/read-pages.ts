/**
 * Every row of a list longer than one page, with the pages after the first
 * read side by side rather than one cursor after another.
 *
 * Appwrite serves at most 100 rows a request, so a cursor walk over a
 * 3,000-location map is thirty requests in series on every page that draws it.
 * Offsets can be asked for all at once — but only once the total is known,
 * which is why the first page asks Appwrite to count and the rest do not.
 *
 * **Offsets are only trusted when they add up.** A row added or removed between
 * the first request and the last shifts every offset after it, which shows up
 * as a duplicate or a gap. Either one makes the de-duplicated count differ from
 * the total the first page reported, and then the whole read is thrown away and
 * `fallback` — the cursor walk this replaced, which cannot skip a row — answers
 * instead. A map that fits one page never gets past the first request.
 */
export async function readPagesInParallel<T>({
  pageSize,
  maxRows,
  concurrency,
  idOf,
  readFirst,
  readAt,
  fallback,
}: {
  pageSize: number;
  /** Past this the parallel read is not attempted; `fallback` decides what happens. */
  maxRows: number;
  /** Requests in flight at once, so a big map cannot open thirty sockets. */
  concurrency: number;
  idOf: (item: T) => string;
  /** The first page, with the table's total. */
  readFirst: () => Promise<{ items: T[]; total: number }>;
  /** One page at `offset`, in the same order as `readFirst`. */
  readAt: (offset: number) => Promise<T[]>;
  /** The sequential read, used whenever the parallel one cannot be trusted. */
  fallback: () => Promise<T[]>;
}): Promise<T[]> {
  const first = await readFirst();
  const { total } = first;

  if (first.items.length === total) return first.items;
  if (first.items.length < pageSize || total > maxRows) return fallback();

  const offsets: number[] = [];
  for (let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);

  const pages = await mapWithConcurrency(offsets, concurrency, readAt);
  const all = first.items.concat(...pages);

  const ids = new Set(all.map(idOf));
  if (all.length !== total || ids.size !== total) return fallback();

  return all;
}

/** `fn` over every input, at most `limit` at a time, results in input order. */
async function mapWithConcurrency<In, Out>(
  inputs: In[],
  limit: number,
  fn: (input: In) => Promise<Out>,
): Promise<Out[]> {
  const results: Out[] = new Array(inputs.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < inputs.length) {
      const index = next;
      next += 1;
      results[index] = await fn(inputs[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, () => worker()),
  );

  return results;
}
