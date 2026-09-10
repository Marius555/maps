import { scrollableAncestor } from "@/lib/map/edge-autoscroll";

/**
 * Bring a fold's contents into view *while* it opens, on the same curve.
 *
 * **The complaint this answers, twice over.** Opening a fold in a long sidebar
 * did nothing visible: the panel grew below the bottom of the scroller, so the
 * controls that just appeared were off screen and you had to go looking for them.
 * That was the first version of this file. It fixed the wrong half — it waited for
 * `transitionend` on the panel's height and *then* called `scrollIntoView`, so the
 * panel finished growing and only then did the view snap. Reported as being
 * "teleported to the content" after the animation, which is exactly what it was.
 *
 * **Why the wait looked necessary, and why it is not.** HeroUI animates the panel's
 * `height` from `--disclosure-panel-height` over 200ms
 * (`@heroui/styles/dist/components/{accordion,disclosure}.css`), so scrolling on the
 * press scrolls against a box that is still a few pixels tall and lands nowhere near
 * where the content ends up. All true — and beside the point, because the finished
 * layout does not have to be waited for to be *known*. React Aria writes the panel's
 * final height, in pixels, inline on the element, and it does it in a **layout**
 * effect (`react-aria/dist/private/disclosure/useDisclosure.mjs`). By the time a
 * component's `useEffect` runs, `--disclosure-panel-height` already holds where the
 * panel is going while `getBoundingClientRect()` still reports where it is. Both ends
 * of the animation are readable on the first frame.
 *
 * **The scroll is not a copy of the growth, it is driven by it.** Rather than
 * re-implementing 200ms of `cubic-bezier(.25,.46,.45,.94)` and hoping the two clocks
 * agree, the loop reads the panel's height each frame, turns it into progress, and
 * puts `scrollTop` at the matching point between here and the target. The two motions
 * are then the same curve by construction: change the duration or the easing in
 * HeroUI's stylesheet and this still tracks it, and a `useEffect` that lands a frame
 * or two after the animation started still finishes with it rather than after it.
 *
 * It also means `prefers-reduced-motion` needs no branch *here*. HeroUI ships
 * `motion-reduce:transition-none`, so there is no transition, the panel is already at
 * its final height when we look, the progress denominator is zero and the target is
 * assigned at once. What it does need is for the fold to still be *found* when no
 * height is moving — see `pickFold`. The old code had a live bug on this path in the
 * other direction: with no transition there is no `transitionend`, so reduced motion
 * waited the full 320ms guard and *then* jumped.
 *
 * `block: "nearest"` semantics are kept — a fold already fully visible is left exactly
 * where it is — but computed against the layout the animation is heading for rather
 * than the one on screen. That distinction is the whole of `project`.
 *
 * **It runs on the close too, and that is a separate bug with a measurement behind
 * it.** Closing the Edit location dialog's last fold with the body scrolled to the
 * bottom: the content shrinks smoothly for the whole 200ms — the last child's bottom
 * walked 1323px to 850px without a stumble — but `Modal.Body.scrollHeight` froze at
 * 1142 the moment `scrollTop` reached the bottom, held there for 150ms while the panel
 * kept collapsing, and only dropped to 853 when React Aria set `hidden` at the end.
 * Chrome stops shrinking a scroller's scrollable overflow while the scroll position is
 * pinned against it, and recomputes on the next thing that forces a full pass. So the
 * view sat still for three quarters of the animation and then jumped 289px in one
 * frame. Driving `scrollTop` ourselves fixes it because a *smaller* value than the
 * stale maximum is always accepted — we are never asking the browser for room it
 * thinks it does not have — and by the time the recalculation lands we are already
 * sitting on the number it arrives at.
 *
 * The sidebars do not show this: their `scrollHeight` tracks the collapse frame by
 * frame, measured at zero direction reversals. Only the modal reproduces it, which is
 * the surface the report named.
 */

/**
 * A transition that never ends must not leave the loop running forever. Long enough
 * to outlast the 200ms panel transition several times over; this is a guard, not a
 * schedule — nothing waits for it in the normal case.
 */
const GIVE_UP_MS = 1000;

/** Below this the height is at its destination and the loop is done. */
const SETTLED_PX = 0.5;

/** Where a fold's panel is now, and where its inline style says it is going. */
export type PanelBox = {
  top: number;
  bottom: number;
  height: number;
  /** The parsed `--disclosure-panel-height`, or `null` for `auto`/unset. */
  finalHeight: number | null;
};

/**
 * How much taller a panel is about to get.
 *
 * Reading *every* panel in the scroller rather than picking out the animating ones
 * is safe, and simpler than tracking which is which: React Aria leaves a settled
 * panel in exactly one of two states — open ones read `auto`, closed and never-opened
 * ones read `0px` against a zero-height box — so both yield zero. Only a panel
 * actually mid-animation has anything to contribute.
 */
export function panelDelta(panel: PanelBox): number {
  if (panel.finalHeight === null) return 0;

  return panel.finalHeight - panel.height;
}

/**
 * Where the fold will be once every panel currently animating has finished.
 *
 * The sibling half of this is what a single-open group needs and the old version did
 * not have. Pressing a fold while the one above it is open collapses that one over
 * the same 200ms, so the fold you pressed rises by its height — and a target computed
 * from where the fold sits *now* is wrong by exactly that, which is a large part of
 * why the correction at the end read as a jump.
 */
export function project(
  item: { top: number; height: number },
  ownPanel: PanelBox,
  panels: PanelBox[],
): { top: number; height: number; contentDelta: number } {
  let above = 0;
  let contentDelta = 0;

  for (const panel of panels) {
    const delta = panelDelta(panel);

    contentDelta += delta;
    if (panel.bottom <= item.top) above += delta;
  }

  return {
    top: item.top + above,
    height: item.height + panelDelta(ownPanel),
    contentDelta,
  };
}

/**
 * `scrollIntoView({ block: "nearest" })`, as arithmetic.
 *
 * The smallest scroll that does the job: a fold already fully inside the scroller
 * does not move at all, one hanging off the bottom comes up just far enough, and one
 * taller than the scroller shows its top rather than its bottom — the last being why
 * the caller hands over the whole item, trigger included, rather than the panel.
 */
export function nearestDelta(
  item: { top: number; height: number },
  view: { top: number; height: number },
): number {
  const offset = item.top - view.top;

  if (item.height > view.height || offset < 0) return offset;

  const overshoot = offset + item.height - view.height;

  return overshoot > 0 ? overshoot : 0;
}

/**
 * `scrollTop` at a given point through the panel's growth.
 *
 * The progress is undefined when there is nothing to animate — the panel is already
 * at its final height, which is both the reduced-motion case and a fold whose panel
 * does not change size. Landing on the target immediately is right for both.
 */
export function scrollAt(
  start: number,
  target: number,
  height: number,
  from: number,
  to: number,
): number {
  const span = to - from;

  if (Math.abs(span) < SETTLED_PX) return target;

  const progress = Math.min(Math.max((height - from) / span, 0), 1);

  return start + (target - start) * progress;
}

/** Reads the inline `--disclosure-panel-height` React Aria writes, in pixels. */
function finalHeightOf(panel: HTMLElement): number | null {
  const declared = parseFloat(
    panel.style.getPropertyValue("--disclosure-panel-height"),
  );

  return Number.isNaN(declared) ? null : declared;
}

function boxOf(panel: HTMLElement): PanelBox {
  const rect = panel.getBoundingClientRect();

  return {
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    finalHeight: finalHeightOf(panel),
  };
}

/** Every fold panel React Aria draws, in both flavours. */
const PANELS = ".accordion__panel, .disclosure__content";

/**
 * Which of a set of panel deltas is the one the reader pressed.
 *
 * A positive delta beats any negative one however large — see `pickFold` for why the
 * grower is the answer on a switch. Among deltas of the same sign the biggest wins.
 * `null` when nothing is moving.
 */
export function pickBestDelta(deltas: number[]): number | null {
  let best: number | null = null;

  for (let i = 0; i < deltas.length; i++) {
    const delta = deltas[i];

    if (delta === 0) continue;

    if (
      best === null ||
      (delta > 0 && deltas[best] < 0) ||
      (delta > 0 === deltas[best] > 0 &&
        Math.abs(delta) > Math.abs(deltas[best]))
    ) {
      best = i;
    }
  }

  return best;
}

/**
 * The fold that just changed, found rather than tracked in React.
 *
 * **The grower wins.** Pressing one fold in a single-open set closes another in the
 * same commit, so two panels are animating and only one of them is the answer — the
 * one you pressed. A plain close has no grower, so the shrinker is the answer instead,
 * and that is the collapse case the docblock's measurement is about.
 *
 * **Nothing animating does not mean nothing happened**, and assuming it did was a bug
 * this file shipped for about an hour. Under `prefers-reduced-motion` HeroUI's
 * `motion-reduce:transition-none` removes the transition, so the panel is already at
 * its final height by the time the effect looks and *every* delta is zero — the fold
 * opened, and the reveal declined to run. Measured: the section landed 808px below
 * the top of the scroller with the view untouched. So the fallback is the panel that
 * is simply expanded, which is the right answer at any speed and the only answer at
 * this one. A set with neither — first render, or a close under reduced motion —
 * yields nothing, and nothing is what should happen.
 *
 * Finding it in the DOM is what lets both call sites be one line and hold no extra
 * state: the thing that has to be measured is React Aria's own panel, carrying the
 * height it animates, and neither `PropertyFold` nor `FormSection` hands a ref back.
 * `data-expanded` is what HeroUI's own stylesheet keys off, so the fallback reads the
 * same signal the animation does.
 */
function pickFold(
  root: HTMLElement,
  itemSelector: string,
): { item: HTMLElement; panel: HTMLElement } | null {
  const panels = [...root.querySelectorAll<HTMLElement>(PANELS)];
  const chosen = pickBestDelta(panels.map((panel) => panelDelta(boxOf(panel))));

  let best = chosen === null ? null : panels[chosen];

  best ??= root.querySelector<HTMLElement>(
    '.accordion__panel[data-expanded="true"], .disclosure__content[data-expanded="true"]',
  );

  if (!best) return null;

  return { item: best.closest<HTMLElement>(itemSelector) ?? best, panel: best };
}

/**
 * Reveal whichever fold in this set is currently animating.
 *
 * @param root The element wrapping the whole set of folds.
 * @param itemSelector What one fold's outermost element looks like — `.accordion__item`
 *   for the designers, `.disclosure` for the form.
 */
export function revealFoldIn(
  root: HTMLElement | null,
  itemSelector: string,
): () => void {
  if (!root) return () => {};

  const found = pickFold(root, itemSelector);

  return found ? revealFold(found.item, found.panel) : () => {};
}

/**
 * @param item The fold's outermost element — the trigger *and* the panel, so a fold
 *   taller than the scroller reveals its top rather than its bottom.
 * @param panel The element whose height animates.
 * @returns A cancel function, for a fold unmounted or re-pressed mid-animation.
 */
export function revealFold(
  item: HTMLElement,
  panel: HTMLElement | null,
): () => void {
  const noop = () => {};

  if (!panel) return noop;

  const ownPanel = boxOf(panel);
  const growth = panelDelta(ownPanel);

  // The reveal is asked one frame before the panel grows, so the scroller it has to
  // move is routinely not overflowing yet — hence the slack. See `scrollableAncestor`.
  const scroller = scrollableAncestor(item, { slack: Math.max(growth, 0) });

  // No scroller of its own means the page is the scroller — the card designer below
  // `lg`, where the panel has no bounded height. There is nothing to interpolate
  // against there, so the settle correction is the whole reveal.
  if (!scroller) {
    item.scrollIntoView({ block: "nearest" });
    return noop;
  }

  const itemRect = item.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();

  const panels = [
    ...scroller.querySelectorAll<HTMLElement>(
      ".accordion__panel, .disclosure__content",
    ),
  ].map(boxOf);

  const final = project(itemRect, ownPanel, panels);

  // `clientTop`/`clientHeight` rather than the rect, so a bordered scroller measures
  // its content box — the part a fold can actually be inside of.
  const view = {
    top: scrollerRect.top + scroller.clientTop,
    height: scroller.clientHeight,
  };

  const start = scroller.scrollTop;

  // Clamped against the height the content is *going* to have. On an open that is
  // because the room has not been made yet; on a close it is the whole point, since
  // the browser's own maximum goes stale the moment we are pinned against it.
  const maxScroll = Math.max(
    scroller.scrollHeight + final.contentDelta - view.height,
    0,
  );
  const target = Math.min(
    Math.max(start + nearestDelta(final, view), 0),
    maxScroll,
  );

  if (target === start) return noop;

  const from = ownPanel.height;
  const to = ownPanel.finalHeight ?? ownPanel.height;

  /**
   * Keys that mean "I am scrolling this myself".
   *
   * Space and Enter are deliberately absent: React Aria toggles a disclosure on
   * `onPressStart` for the keyboard, so the keypress that *opens* a fold is a
   * `keydown` on its trigger. Cancelling on those would mean a fold opened from the
   * keyboard never reveals at all — and it would look like the reveal working for
   * a mouse and silently not for a keyboard.
   */
  const SCROLL_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
  ]);

  let frame: number | null = null;
  let timer = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame !== null) cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    // Not `scroll`: our own writes fire that, and cancelling on them would end the
    // reveal on its first frame.
    window.removeEventListener("wheel", stop, true);
    window.removeEventListener("touchmove", stop, true);
    window.removeEventListener("keydown", onKeyDown, true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) stop();
  };

  const settle = () => {
    scroller.scrollTop = target;
    // The corrective net, and the reason the projection is allowed to be an
    // estimate. It is a no-op whenever the interpolation landed, which is the
    // normal case — and it is the whole answer when the chosen scroller turned out
    // not to be one, because a container whose height follows its content cannot be
    // told apart from a bounded one until the growth has happened. `nearest` then
    // walks up to whatever really scrolls, which is what the old implementation did
    // and the one part of it worth keeping.
    item.scrollIntoView({ block: "nearest" });
    stop();
  };

  const step = () => {
    frame = null;
    if (stopped) return;

    const height = panel.getBoundingClientRect().height;

    scroller.scrollTop = scrollAt(start, target, height, from, to);

    if (Math.abs(height - to) <= SETTLED_PX) {
      settle();
      return;
    }

    frame = requestAnimationFrame(step);
  };

  timer = window.setTimeout(settle, GIVE_UP_MS);

  // Never fight a user who takes over the scroller mid-animation. Capture, so a
  // `stopPropagation` further down cannot hide the handover from us.
  const listening = { capture: true, passive: true } as const;

  window.addEventListener("wheel", stop, listening);
  window.addEventListener("touchmove", stop, listening);
  window.addEventListener("keydown", onKeyDown, listening);

  step();

  return stop;
}
