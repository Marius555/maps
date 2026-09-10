"use client";

import { Accordion } from "@heroui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { revealFoldIn } from "@/lib/ui/reveal-fold";

/**
 * A set of `PropertyFold`s: one open at a time, and nothing open to begin with.
 *
 * `PropertyFold` deliberately owns none of this — "whether several folds may be
 * open at once, and which start open, are questions about the set rather than
 * about any one of them", says its docblock, and this is the set. Every panel in
 * the app now answers those two questions the same way, which is why the answer
 * lives in one component instead of four sets of props.
 *
 * **This reverses two decisions recorded in docs/notes/cards.md, on purpose.**
 * The publish sidebar opened on "Results panel" and the block palette opened on
 * *every* shelf, each with an argument for it — comparing a panel setting against
 * a colour is real; hiding the block you came for is a click for nothing. What
 * neither argument survives is the two of them together, plus the Modify panel's
 * seven: a 24rem column with several folds open is a wall again, which is the
 * thing folding was introduced to stop. Closed-and-one-at-a-time is the rule the
 * Edit location dialog had all along, and three panels disagreeing with it was
 * the actual inconsistency.
 *
 * Single-open costs no state code: `Accordion` is react-aria's `DisclosureGroup`
 * and that is already its default — the four call sites were each asking for the
 * other behaviour with `allowsMultipleExpanded`.
 *
 * It also fixes the collapse, for free and by accident. Closing the last fold in
 * a scroller stuttered because react-aria animates its height to `0px` while the
 * browser corrects `scrollTop` underneath it (see place-form.tsx); with one fold
 * open the column is short enough that there is barely any `scrollTop` left to
 * correct. `overflow-anchor: none` in app/globals.css handles the rest.
 */
export function PropertyFolds({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  /*
   * Follow whichever fold just changed, in step with it — not after it. Opening and
   * closing both, because the collapse has its own reason to be driven; see
   * `revealFold`, which is where the whole of that timing lives.
   *
   * No early return on `openId === null`: that *is* the plain close, and the close is
   * the case with the 289px jump at the end of it.
   */
  useEffect(() => revealFoldIn(root.current, ".accordion__item"), [openId]);

  return (
    <div ref={root} className={className}>
      <Accordion
        expandedKeys={openId === null ? [] : [openId]}
        onExpandedChange={(keys) => {
          const [first] = keys;

          setOpenId(first === undefined ? null : String(first));
        }}
      >
        {children}
      </Accordion>
    </div>
  );
}
