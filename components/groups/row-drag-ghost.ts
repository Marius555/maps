/**
 * The row that follows the pointer while one is being dragged.
 *
 * It is a **copy of the row element itself**, cloned out of the list. That is the
 * whole point of this file: it used to build a small chip with the object's name
 * in it, and a name in a box is a reference to the thing being dragged rather
 * than the thing. Cloning means the pin, the address, the second line, the status
 * flag and the group's colour all travel with no code here knowing that any of
 * them exist — and none of them can drift, because there is only one description
 * of a row and this is a copy of it.
 *
 * Plain DOM rather than a React portal, for the same reason the pin ghost next
 * door is (components/map/add-location/drag-ghost.ts): it is moved sixty times a
 * second, and every one of those moves would otherwise be a render of the whole
 * panel.
 *
 * On `document.body`, because the panel scrolls and clips — a row dragged towards
 * the edge of the list would be cut in half by an ancestor's `overflow: hidden`,
 * which `position: fixed` does not escape on its own.
 */

/** Where inside the row the pointer landed, so the copy is held at that point. */
export type GrabOffset = { x: number; y: number };

export type RowGhost = {
  root: HTMLElement;
  offset: GrabOffset;
};

/**
 * Clone the row, put it under the pointer, and fade it in.
 *
 * Creation and mounting are one call because the order matters and is easy to get
 * wrong in three: positioned *before* it is appended, so it never paints for a
 * frame at the viewport's corner and snaps; and lifted only after a forced
 * reflow, so the browser has computed the transparent state and has something to
 * animate away from.
 */
export function mountRowGhost(
  source: HTMLElement,
  x: number,
  y: number,
  offset: GrabOffset,
  size: { width: number; height: number },
): RowGhost {
  const root = document.createElement("div");
  root.className = "row-ghost";
  root.setAttribute("aria-hidden", "true");

  /*
   * The box the source actually occupied, both dimensions, measured at the press.
   *
   * A row is `flex-1` inside its `<li>` and has no width of its own, so appended
   * to `<body>` it would shrink to its contents and the copy would be visibly
   * narrower than the row it came from. That was the original reason for the
   * width; the height is here for a stronger one, below.
   */
  root.style.width = `${size.width}px`;
  root.style.height = `${size.height}px`;

  const copy = source.cloneNode(true) as HTMLElement;

  /*
   * The copy fills that box, whatever it thought it was.
   *
   * **A clone keeps its inline styles, and they mean something else here.** A
   * card block narrowed to 40% carries `flex: 0 0 calc(40% - 4px)` — which this
   * root is not a flex container to honour — and before that it carried
   * `width: 40%`, which resolved against a root that was *already* the block's
   * 40%. The thing under the pointer was 16% of the card: a strip, which reads
   * as dragging the block's border rather than the block, and which then wore
   * the removal ring's red outline the moment it left the card. A bleeding
   * gallery's negative inline margins shifted the copy inside its own root the
   * same way.
   *
   * So every property that sized the source *against its parent* is neutralised,
   * and the root — measured off the real element — is what says how big the
   * ghost is. Nothing about how the block looks is touched.
   */
  copy.style.width = "100%";
  copy.style.height = "100%";
  copy.style.flex = "none";
  copy.style.margin = "0";
  copy.style.alignSelf = "auto";

  /*
   * The two attributes the hit test looks for.
   *
   * `use-row-drag.ts` resolves a drop with `elementFromPoint(...).closest(
   * "[data-drop-id]")`, and a copy of the row sitting under the pointer carries
   * the original's id — so the drag would find *itself* as the target of every
   * sample. `pointer-events: none` on the wrapper already keeps it out of the
   * hit test; stripping these means it is not a target even if that ever changes.
   */
  copy.removeAttribute("data-drop-id");
  copy.removeAttribute("data-drop-target");

  root.append(copy);
  moveRowGhost({ root, offset }, x, y);
  document.body.append(root);

  // Reading a layout property is what forces the pending style to be computed.
  void root.offsetWidth;
  root.classList.add("row-ghost--lifted");

  return { root, offset };
}

/**
 * Position only — one compositor property, no layout, no transition.
 *
 * Offset by where the pointer was *within the row* when it was pressed, so the
 * copy stays under the same part of itself for the whole gesture. Snapping it to
 * a corner is what made the old chip read as a separate object being carried
 * rather than as the row having been picked up.
 */
export function moveRowGhost(ghost: RowGhost, x: number, y: number): void {
  ghost.root.style.transform = `translate3d(${Math.round(x - ghost.offset.x)}px, ${Math.round(
    y - ghost.offset.y,
  )}px, 0)`;
}
