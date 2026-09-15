import { animate, motionValue } from "motion/react";

import { MAGNET_SPRING } from "@/components/ui/list-row-motion";
import type { SnapBox } from "./row-drag-context";
import {
  moveRowGhost,
  placeRowGhost,
  type GhostBox,
  type RowGhost,
} from "./row-drag-ghost";

/**
 * The copy in the hand, pulled onto the place it would land.
 *
 * **Drawing only, and that is the property everything else rests on.** Which
 * target a release lands on is still decided from the *pointer* —
 * `elementFromPoint` in use-row-drag.ts — and the ghost is `pointer-events:
 * none`, so where this puts the copy cannot change where a drop goes. A surface
 * that registers a resolver (`registerSnap` in row-drag-context.tsx) changes how
 * its drag looks and nothing about what it does. A surface that registers none
 * gets `moveRowGhost`, sample for sample, exactly as before this existed.
 *
 * Plain DOM and vanilla Motion rather than a component, for `row-drag-ghost.ts`'s
 * reason: the copy moves sixty times a second and a render per sample is the
 * thing that file exists to avoid.
 *
 * **One progress value, not a spring per coordinate.** Every change of target —
 * onto a slot, from one slot to the next, back to the pointer — captures the box
 * as currently drawn and springs `progress` from 0 to 1, drawing
 * `mix(from, to, progress)` each frame. What that buys is the return: `to` is
 * the *live* pointer box, read on every frame, so a copy let go by a slot while
 * the hand keeps moving converges on the hand exactly, rather than chasing a
 * target that moved since the spring was aimed. Once it arrives it hands back to
 * `moveRowGhost`.
 *
 * **Seated, the copy sheds the root's chrome and shrinks inside the slot.** It
 * used to be pulled onto a slot at exactly the slot's size wearing an accent
 * border and ring, so its solid edge sat on the slot mark's dashed one — one
 * border drawn twice — and the white ground under it read as a grey slab on a
 * glass card. Now the root draws nothing (`.row-ghost--snapped`), the spot's
 * dashes are the only edge, and the copy is *scaled*, never laid out again,
 * until it sits `SNAP_INSET` inside the slot. The scale rides the same
 * `progress` as the box, so shrinking in and growing back out are one movement.
 *
 * **A copy that only stands for the block steps aside instead** (`fit:
 * "preview"`). A palette tile is a pill, and seated in a spot the size of a
 * photo it was a small label lost in a large box; the surface draws the real
 * block in the spot, so the pill fades out while it is there.
 *
 * **`prefers-reduced-motion` keeps the snap and loses the spring.** Being pulled
 * onto a slot is information — it says *here* — so it still happens, in one
 * frame. `MotionConfig` in app-providers does not reach a vanilla `animate`,
 * which is why the query is asked here.
 */

/** Worn while the copy sits on a slot. See app/globals.css. */
const SNAPPED_CLASS = "row-ghost--snapped";

/**
 * Worn with it while the surface is drawing the block itself and the copy is
 * only a stand-in for it — a palette tile. See `SnapBox.fit`.
 */
const PREVIEW_CLASS = "row-ghost--previewed";

/**
 * How far inside a slot the seated copy stops, in px on every side.
 *
 * It was the slot mark's 2px of dashes and one pixel of air. The mark is a tint
 * with no edge now (`.card-drop-slot`), and the number stayed: the spot's own
 * dashes sit on the mark's edge, and a copy flush with the mark's box would
 * cover them. Not more: the copy shrinks uniformly to fit, and on a 24px name
 * every pixel here comes off the text as well.
 */
const SNAP_INSET = 3;

/** The copy melting into the block that just landed under it. */
const SETTLE_OUT = { duration: 0.12, ease: [0, 0, 0.2, 1] } as const;

/**
 * How a drag's copy leaves the screen. `"settle"` is a drop that landed while
 * the copy was sitting on its slot, so it fades into the block appearing under
 * it; everything else — a release over nothing, Escape, a cancel — is removed
 * in the same frame, as it always was.
 */
export type GhostExit = "settle" | "remove";

export type GhostMagnet = {
  /**
   * One pointer sample. `key` names the target the pointer is over and `snap`
   * is where that target pulls the copy — null for a target that does not
   * pull, which lets it follow the pointer.
   */
  follow: (x: number, y: number, key: string | null, snap: SnapBox | null) => void;
  /** Whether the copy is on a slot right now. */
  isSnapped: () => boolean;
  dispose: (exit: GhostExit) => void;
};

export function createGhostMagnet(
  ghost: RowGhost,
  /** The copy's own size, measured at the press — what it returns to. */
  size: { width: number; height: number },
  x: number,
  y: number,
): GhostMagnet {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /*
   * The copy itself, inside the root `mountRowGhost` built — what is scaled
   * while it is seated. Its inline sizing and transform are kept as they were
   * written, so carrying it again puts back exactly what that function (and, on
   * a moved block's clone, Motion) left there.
   */
  const child = ghost.root.firstElementChild;
  const copy = child instanceof HTMLElement ? child : null;
  const rest = copy
    ? {
        width: copy.style.width,
        height: copy.style.height,
        transform: copy.style.transform,
        origin: copy.style.transformOrigin,
      }
    : null;

  let pointer = { x, y };
  /** Which target the copy is on, or null for the pointer. */
  let key: string | null = null;
  let snap: SnapBox | null = null;
  /** True while `moveRowGhost` owns the copy and nothing is being drawn here. */
  let isFollowing = true;
  let from = pointerBox();
  let drawn = from;
  /** The copy's scale: where the spring set off from, where it is going, and where it is. */
  let scaleFrom = 1;
  let scaleTo = 1;
  let scaleDrawn = 1;
  let animation: ReturnType<typeof animate> | null = null;

  const progress = motionValue(1);
  const unsubscribe = progress.on("change", () => draw());

  function pointerBox(): GhostBox {
    return {
      left: pointer.x - ghost.offset.x,
      top: pointer.y - ghost.offset.y,
      width: size.width,
      height: size.height,
    };
  }

  /**
   * How small the copy has to be drawn to sit inside a slot.
   *
   * A block's copy is laid out at the slot's own size — the width and height
   * that will land — so it is fitted from that. A stand-in is not fitted at all:
   * it is fading out while the surface draws the block, and scaling a pill into
   * a box that is not its shape would only be a second picture of the wrong
   * thing on the way out.
   */
  function fitScale(box: SnapBox): number {
    if (box.fit === "preview") return 1;

    const width = box.width - SNAP_INSET * 2;
    const height = box.height - SNAP_INSET * 2;
    if (width <= 0 || height <= 0) return 1;

    return Math.min(width / box.width, height / box.height);
  }

  /**
   * The copy's look for a target: seated as a block, stepping aside for the
   * surface's preview, or carried.
   *
   * `mountRowGhost` stretches the copy over its root, which is right for a block
   * — the root is the slot, and the block fills it — and wrong for a stand-in: a
   * pill stretched to a photo-sized slot while it fades is a pill squashed. It is
   * laid out at its own size instead and the root centres it
   * (`.row-ghost--previewed`).
   */
  function dress(next: SnapBox | null) {
    const isPreview = next?.fit === "preview";

    ghost.root.classList.toggle(SNAPPED_CLASS, next !== null);
    ghost.root.classList.toggle(PREVIEW_CLASS, isPreview);

    if (!copy || !rest) return;

    copy.style.width = isPreview ? "auto" : rest.width;
    copy.style.height = isPreview ? "auto" : rest.height;
    if (next) copy.style.transformOrigin = "50% 50%";
  }

  function draw() {
    if (isFollowing) return;

    // A slot's box is the copy's box: the shrink is the scale's job, not a
    // smaller box, so a block's copy is laid out at exactly what lands.
    const to: GhostBox = snap ?? pointerBox();
    const p = progress.get();

    drawn = {
      left: mix(from.left, to.left, p),
      top: mix(from.top, to.top, p),
      width: mix(from.width, to.width, p),
      height: mix(from.height, to.height, p),
    };
    placeRowGhost(ghost, drawn);

    scaleDrawn = mix(scaleFrom, scaleTo, p);
    if (copy) copy.style.transform = `scale(${scaleDrawn})`;
  }

  /** The spring has arrived. If it arrived at the hand, the hand has it again. */
  function arrive() {
    animation = null;
    if (snap) return;

    isFollowing = true;
    drawn = pointerBox();
    placeRowGhost(ghost, drawn);

    scaleDrawn = 1;
    if (copy && rest) {
      copy.style.transform = rest.transform;
      copy.style.transformOrigin = rest.origin;
    }
  }

  return {
    follow(nextX, nextY, nextKey, nextSnap) {
      pointer = { x: nextX, y: nextY };
      const target = nextSnap ? nextKey : null;

      if (target === key) {
        /*
         * The same place as last sample. A slot's box is still taken fresh —
         * the workspace can scroll under a drag — but nothing is restarted, so
         * the spring already running keeps going towards it.
         */
        if (nextSnap) snap = nextSnap;

        if (isFollowing) {
          drawn = pointerBox();
          moveRowGhost(ghost, nextX, nextY);
        } else {
          draw();
        }
        return;
      }

      // A new target: spring from wherever the copy is drawn right now.
      from = drawn;
      scaleFrom = scaleDrawn;
      key = target;
      snap = nextSnap;
      isFollowing = false;
      animation?.stop();

      dress(nextSnap);
      scaleTo = nextSnap ? fitScale(nextSnap) : 1;

      if (reduced) {
        progress.jump(1);
        draw();
        arrive();
        return;
      }

      progress.jump(0);
      // `jump` only notifies on a change, and progress may already be 0.
      draw();
      animation = animate(progress, 1, { ...MAGNET_SPRING, onComplete: arrive });
    },

    isSnapped: () => snap !== null,

    dispose(exit) {
      animation?.stop();
      unsubscribe();

      const { root } = ghost;

      if (exit === "remove" || reduced) {
        root.remove();
        return;
      }

      /*
       * `.row-ghost` fades its opacity in with a CSS transition, and a
       * transition left on the element would ease every frame Motion writes.
       * The timeout is a guard, not a guess: a promise from an animation that
       * never finishes never settles, and a copy left on `<body>` is a copy
       * stuck on screen.
       */
      root.style.transition = "none";
      const remove = () => root.remove();
      void animate(root, { opacity: 0 }, SETTLE_OUT).then(remove, remove);
      window.setTimeout(remove, 400);
    },
  };
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
