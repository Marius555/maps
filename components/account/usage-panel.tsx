import type { LookupUsage } from "@/lib/repositories/usage.repository";

/**
 * Address lookups used this month, against what the plan allows.
 *
 * **Stated rather than discovered.** This is the only limit in the product a
 * customer can hit without doing anything they would recognise as creating
 * something — a map, a location and a shape are all things you can see and count,
 * and a lookup is not. Leaving it to be announced by a refusal in the middle of an
 * import would be the worst possible first mention of it.
 *
 * It is also why the copy explains what a lookup *is* in one line. "Address
 * lookups: 312 of 4,000" is a number nobody can act on without knowing which of
 * their actions spends one.
 */
export function UsagePanel({ usage }: { usage: LookupUsage }) {
  const share = usage.limit > 0 ? Math.min(usage.used / usage.limit, 1) : 0;
  const percent = Math.round(share * 100);

  /*
   * Three bands, and the thresholds are about what the reader should do, not
   * about arithmetic: below 75% there is nothing to think about, above 90% there
   * is a decision coming this month.
   */
  const tone =
    share >= 0.9
      ? "bg-danger"
      : share >= 0.75
        ? "bg-warning"
        : "bg-accent";

  return (
    <section className="rounded-xl bg-surface-secondary p-5">
      <h2 className="text-sm font-medium text-muted">Address lookups</h2>

      <p className="mt-1 text-2xl font-semibold text-foreground">
        {grouped(usage.used)}
        <span className="text-base font-normal text-muted">
          {" "}
          of {grouped(usage.limit)} this month
        </span>
      </p>

      {/*
       * `role="img"` with a label rather than a progressbar: nothing here is in
       * progress, and the figure above is already the accessible answer. The bar
       * is the shape of it, for people who read shapes faster than numbers.
       */}
      <div
        role="img"
        aria-label={`${String(percent)}% of this month's address lookups used`}
        className="mt-4 h-2 overflow-hidden rounded-full bg-default"
      >
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${String(Math.max(percent, share > 0 ? 2 : 0))}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-muted">
        One lookup is one address turned into a point on the map — importing a
        row, dropping a pin, or searching for a place. Resets on the 1st.
      </p>
    </section>
  );
}

/**
 * Thousands separators without `Intl`.
 *
 * The same call `lib/repositories/errors.ts` makes and for the same recorded
 * reason: `Intl.NumberFormat` does not agree across Node and Chrome, and this
 * figure is server-rendered beside a refusal message that may be composed in
 * either. Two spellings of one allowance on one screen is the bug being avoided.
 */
function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
