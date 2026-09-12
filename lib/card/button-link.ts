/**
 * The scheme a typed-out button link wears, and does not show.
 *
 * **Nobody types `https://`.** Asked for a link, people write `acme.com/book`,
 * and a box that refuses that is a box that refuses the normal answer. But what
 * is *stored* has to be a whole URL: `safeHref` in packages/shared/card-button.ts
 * parses it with `new URL()` and admits http(s) alone, in both renderers, and a
 * bare host does not parse. So the scheme is added on the way in and hidden on
 * the way out, and the control draws it as fixed furniture beside the box so the
 * two halves still agree about what is saved.
 *
 * Here rather than in the component because it is a rule with edges — a link
 * pasted complete, a link pasted with `http://` on purpose — and edges are worth
 * a test.
 */

/**
 * A scheme, and the `//` is required.
 *
 * `scheme:` alone would also match `acme.com:8080`, and a host with a port is a
 * far more plausible thing to type than `mailto:`. The cost is that
 * `javascript:alert(1)` is not recognised and gets prefixed like any other
 * typing — which is the right way round: the result does not parse at all, so
 * `safeHref` refuses it, where storing it verbatim would leave a live one in the
 * column waiting on a future reader that forgot to check.
 */
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * What the box shows for a stored link.
 *
 * `https://` alone is hidden, because it is what we add. **`http://` is kept**:
 * somebody who wrote it meant it, and silently showing the host alone would make
 * the next keystroke promote their link to https without them asking.
 */
export function linkForDisplay(stored: string | undefined): string {
  return (stored ?? "").replace(/^https:\/\//i, "");
}

/**
 * What a typed link is stored as.
 *
 * An empty box stays empty — that is how the field is cleared, and prefixing a
 * scheme onto nothing would store a link to nowhere that `safeHref` then has to
 * reject on every draw.
 *
 * **The whitespace is tested, never written back.** This is a controlled input
 * committing on every keystroke, so trimming what it stores means the box
 * re-renders a character short of what was typed — the bug `card-edits.ts`
 * records at length about `buttonLabel` ("Book now" arriving as "Booknow"). So
 * the blank test reads the trimmed value and the store keeps the raw one.
 */
export function linkForStorage(typed: string): string {
  const trimmed = typed.trim();

  if (!trimmed) return "";

  return SCHEME.test(trimmed) ? typed : `https://${typed}`;
}
