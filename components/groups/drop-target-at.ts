import type { DropTarget } from "./row-drag-context";
import type { DraggedObject } from "./use-row-drag";

/**
 * The registered target under a point that would take `object`, or null.
 *
 * Found by walking up from `elementFromPoint` to the nearest `data-drop-id`, so
 * the answer is whatever is *at the pointer* — a drag's copy is
 * `pointer-events: none` and never in the way (row-drag-ghost.ts). Skipped unless
 * it accepts, which is what lets a group pass over its own members without
 * lighting any of them.
 *
 * Its own module because two things ask it — the press-and-move gesture
 * (use-row-drag.ts) and the click-to-place carry (use-tap-carry.ts) — and a place
 * one of them could land on and the other could not would be two answers to
 * where a block goes. Being its own module also keeps the drag context and the
 * carry hook from importing each other.
 */
export function dropTargetAt(
  find: (id: string) => DropTarget | undefined,
  object: DraggedObject,
  x: number,
  y: number,
): string | null {
  const element = document.elementFromPoint(x, y);
  const host = element?.closest<HTMLElement>("[data-drop-id]");
  const id = host?.dataset.dropId;
  if (!id) return null;

  return find(id)?.accepts(object) ? id : null;
}
