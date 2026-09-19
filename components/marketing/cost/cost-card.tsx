/**
 * One of the calculator's two cards, and the row skeleton that keeps them
 * level with each other.
 *
 * **They used to be one panel with a two-column grid in it, and the two columns
 * did not line up.** Measured: the left column opened with a 36px row — a label
 * beside a `text-3xl` readout — and the right opened with a bare 20px
 * paragraph, so every row under them was out of step too; the left column's
 * first bar sat 78px below the right column's. Nothing was wrong with either
 * half on its own, which is why it survived: it is only visible as a pair.
 *
 * The fix is structural rather than a set of matched margins. Both cards are
 * `flex flex-col` and both are built from the same three parts:
 *
 * 1. `CostCardHeader` — one component, so row one cannot drift.
 * 2. whatever the card is about, in the middle.
 * 3. a `CostCardBars` block pinned to the bottom with `mt-auto`.
 *
 * That last one is what actually holds the alignment. The middles are a slider
 * on one side and an itemised list on the other, and they will never be exactly
 * the same height for long; pinning the bars to the bottom of a stretched card
 * means the bars line up anyway, whatever the middles do.
 *
 * `h-full` plus the grid's `items-stretch` is what gives both cards the same
 * height to be pinned inside.
 */
export function CostCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk-panel flex h-full flex-col rounded-2xl p-5 sm:p-6 lg:p-7">
      {children}
    </div>
  );
}

/**
 * Row one: what the card is, and its one big number.
 *
 * `htmlFor` turns the label into a real `<label>` — the views card's is the
 * slider's, and a label that does not point at its control is a label that does
 * nothing.
 *
 * `valueHidden` exists for that same card and nowhere else: the slider's own
 * `aria-valuetext` already says "50,000 views a month", so the readout beside it
 * would be the number announced twice. On the other card this readout is the
 * only place the total is stated, so it stays in the tree.
 */
export function CostCardHeader({
  label,
  htmlFor,
  value,
  valueHidden = false,
}: {
  label: string;
  htmlFor?: string;
  value: React.ReactNode;
  valueHidden?: boolean;
}) {
  const Label = htmlFor ? "label" : "p";

  return (
    <div className="flex items-baseline justify-between gap-4">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <span
        aria-hidden={valueHidden || undefined}
        className="text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl"
      >
        {value}
      </span>
    </div>
  );
}

/** The bars, at the foot of the card — see the note above on `mt-auto`. */
export function CostCardBars({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto space-y-4 pt-7">{children}</div>;
}
