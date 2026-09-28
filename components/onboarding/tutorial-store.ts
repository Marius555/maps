import type { TutorialId } from "@/lib/onboarding/tutorials";

/**
 * Which onboarding overlays this tab has closed, and which one is on screen.
 *
 * **Dismissed** is module state, so a Back or Forward that replays a page from
 * the router cache — where the server still said "show" — does not bring an
 * overlay back; a reload starts clean, which is what lets
 * `TUTORIAL_ALWAYS_PRESENT` show them on every load.
 *
 * **Open** is the one overlay allowed on screen. Two can be due at once — the
 * shell's Publish overlay arriving on an empty map whose editor overlay is still
 * unseen — and two scrims of arrows at once reads as neither. So an overlay
 * claims the screen when it mounts, and one that finds it taken waits for the
 * other to close.
 *
 * A store rather than React state because the overlays live in different trees:
 * the editor's in the page, Publish's in the dashboard shell.
 */
const dismissed = new Set<TutorialId>();
let open: TutorialId | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTutorials(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isTutorialDismissed(id: TutorialId): boolean {
  return dismissed.has(id);
}

export function openTutorial(): TutorialId | null {
  return open;
}

/** Closed for the rest of this tab. The caller writes the "seen" stamp. */
export function dismissTutorial(id: TutorialId): void {
  dismissed.add(id);
  if (open === id) open = null;
  emit();
}

/** Takes the screen if nobody holds it. */
export function claimTutorial(id: TutorialId): void {
  if (open !== null || dismissed.has(id)) return;
  open = id;
  emit();
}

/** Gives the screen back, for an overlay unmounted without being closed. */
export function releaseTutorial(id: TutorialId): void {
  if (open !== id) return;
  open = null;
  emit();
}
