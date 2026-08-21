import { CircleCheck, CircleHelp, CircleX } from "lucide-react";

import type { Confidence } from "@/lib/import/column-mapping";

/**
 * How sure we are about one column, as a single mark.
 *
 * This was a chip with a word in it — "Detected", "Likely", "Guessed" — sitting
 * under the column name in `text-xs`. Two problems. It was a second type size
 * and a second line for something that qualifies the field title above it, and
 * across fifteen columns a row of little amber pills is louder than the data it
 * is annotating. So: no word, no chip, one icon on the title's own line at the
 * title's own size.
 *
 * **Shape carries the meaning, colour only reinforces it.** That is not a
 * flourish — dropping the word means colour and shape are all that is left, and
 * colour alone fails for anyone who can't separate amber from grey. Hence four
 * genuinely different glyphs rather than one glyph in four colours, plus an
 * `sr-only` word so nothing is lost to a screen reader and a `title` carrying
 * the detector's reason for anyone hovering.
 *
 * **Amber comes from `--warning-ink`, not `--warning`.** The latter is a fill
 * token with a foreground partner and lands near 2:1 used directly, which is the
 * whole reason the old version needed a chip to sit in. See app/globals.css.
 */
type Style = {
  /** Announced, not drawn. The mark itself is silent. */
  label: string;
  icon: typeof CircleCheck;
  className: string;
};

const DETECTED: Style = {
  label: "Detected",
  icon: CircleCheck,
  className: "text-muted",
};

const STYLES: Record<Confidence, Style> = {
  // Header and values agreed. Settled, so it stays as quiet as the column name.
  confident: DETECTED,
  // One strong signal, uncorroborated. Worth a glance, not an alarm.
  likely: { label: "Likely", icon: CircleCheck, className: "text-warning-ink" },
  // Same amber, different shape: a question mark says we were reaching, which a
  // second amber tick could not say once the words came off.
  guess: { label: "Guessed", icon: CircleHelp, className: "text-warning-ink" },
  // Only ever set for a field we did *not* place, so it never reaches an
  // assigned column. `isAssigned` is what actually draws the red mark.
  none: { label: "No match", icon: CircleX, className: "text-danger" },
};

const NO_MATCH: Style = STYLES.none;

export function ConfidenceMark({
  /** What detection thought. Absent on a column the user has since answered. */
  confidence,
  /**
   * Whether the column feeds a field at all.
   *
   * Checked *before* `confidence`, and that ordering is the whole subtlety here.
   * `import-store.ts` deletes the detection entry the moment the user picks a
   * field — "our guess is no longer what's on screen" — so an assigned column
   * with no confidence is a column the user answered themselves. That is the
   * most settled state there is, and reading it as a red no-match would put a
   * warning on the one thing we know is right.
   */
  isAssigned,
  reason,
}: {
  confidence: Confidence | undefined;
  isAssigned: boolean;
  reason: string | null;
}) {
  const style = !isAssigned
    ? NO_MATCH
    : confidence
      ? STYLES[confidence]
      : DETECTED;

  const Icon = style.icon;

  return (
    /*
     * A span carries the tooltip, not the svg: `title` on an `<svg>` is just an
     * unknown attribute, and SVG's own tooltip is a `<title>` *child* lucide
     * does not render. On the wrapper it is the ordinary HTML tooltip.
     *
     * `inline-block`, not a flex row: this sits inside the select trigger's own
     * `truncate` span, and a flex item there would break the ellipsis. `size-4`
     * against the title's text-sm/20px line box.
     */
    <span
      title={reason ?? undefined}
      className={`mr-1 inline-block align-[-0.2em] ${style.className}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{style.label}. </span>
    </span>
  );
}
