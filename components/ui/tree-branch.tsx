"use client";

import type { CSSProperties } from "react";

/**
 * The rail and elbow that tie a group's members to its header.
 *
 * Membership used to be a single `ms-4` — a step in from the left and nothing
 * else — which says "this row is different" without saying *what it belongs to*.
 * With two groups open, the only way to answer that was to scroll up and find the
 * nearest header. A rail answers it in place: follow the line up, and there it is.
 *
 * The rail wears a tint of the group's own colour rather than a neutral grey,
 * because the group's colour is already what its members' pins are painted on the
 * map (see `colorFor` in components/editor/map-editor.tsx). A tint and not the
 * colour itself — at full strength the rail competes with the pins it is pointing
 * at, and there are as many rails as there are rows.
 *
 * Decorative, so `aria-hidden`. The tree it draws is already in the markup: the
 * group's header is a button with `aria-expanded`, and its members follow it.
 */
export function TreeBranch({
  color,
  isLast,
}: {
  /** The group's colour. Undefined falls back to the border grey. */
  color?: string;
  /** The final member: the rail stops at the elbow instead of running on. */
  isLast: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-last={isLast || undefined}
      style={color ? ({ "--tree-color": color } as CSSProperties) : undefined}
      /*
       * A sibling of the row, never a child of it — that is what keeps the rail
       * out from under the row's own background. Inside, the hover and selected
       * fills painted straight over the gutter and the line disappeared under a
       * block of colour exactly when the pointer was on it.
       *
       * `-mb-0.5` reaches into the 2px gap `LIST_ROW_CLASS` puts between rows, so
       * the rail is one continuous line down the group rather than a dotted
       * column of 48px segments. The row `<li>` is `overflow-hidden`, which clips
       * it back correctly while the height animates on enter and exit.
       */
      className="tree-branch -mb-0.5 w-4 shrink-0 self-stretch"
    />
  );
}
