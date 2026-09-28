"use client";

import { Button } from "@heroui/react";
import { EyeOff, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/icon-button";
import type { TutorialId } from "@/lib/onboarding/tutorials";
import { useDismissAllTutorials, useMarkTutorialSeen } from "@/lib/query/account";
import { type Callout, CALLOUTS } from "./callouts";
import { ScribbleArrow } from "./scribble-arrow";
import { scrimClipPath } from "./tutorial-layout";
import { TutorialNote } from "./tutorial-note";
import {
  claimTutorial,
  dismissAllTutorials,
  dismissTutorial,
  isTutorialDismissed,
  openTutorial,
  releaseTutorial,
  subscribeTutorials,
} from "./tutorial-store";
import { useTutorialLayout } from "./use-tutorial-layout";

/**
 * An onboarding overlay: hand-drawn arrows at the controls that matter on this
 * page, an X to close it, and beside the X a button that closes every overlay
 * for good. What each one points at is in `callouts.ts`.
 *
 * The server decides whether to render this (`lib/auth/tutorial.ts`); closing
 * it is what marks it seen, never showing it. Pressing a thing an arrow points
 * at closes it too, and counts the same. Only one is on screen at a time; a
 * second waits for the first to close (`tutorial-store.ts`).
 *
 * **The scrim is barely there, on purpose** — the point is to be able to see
 * what the arrows point at. It takes the pointer everywhere except inside the
 * rings, which are cut out of it, so the first click lands on the X or on a
 * target rather than half-arming some other control underneath.
 *
 * Portalled to the body because `fixed` is only fixed to the viewport when no
 * ancestor has a transform, and this renders inside the page's own tree.
 */
export function Tutorial({ id }: { id: TutorialId }) {
  // The server snapshot says dismissed, so nothing is drawn until hydration.
  const isDismissed = useSyncExternalStore(
    subscribeTutorials,
    () => isTutorialDismissed(id),
    () => true,
  );
  const open = useSyncExternalStore(subscribeTutorials, openTutorial, () => null);
  const markSeen = useMarkTutorialSeen(id);
  const dismissAll = useDismissAllTutorials();

  // Take the screen whenever it is free — on mount, or when the overlay ahead
  // of this one closes.
  useEffect(() => {
    if (!isDismissed && open === null) claimTutorial(id);
  }, [id, isDismissed, open]);

  useEffect(() => () => releaseTutorial(id), [id]);

  const close = () => {
    dismissTutorial(id);
    markSeen.mutate();
  };

  // Every overlay, not just this one: the ones still ahead of the owner are
  // stamped too, so none of them comes back — unless `TUTORIAL_ALWAYS_PRESENT`
  // is on, which draws them all on the next load whatever the stamps say.
  const hideAll = () => {
    dismissAllTutorials();
    dismissAll.mutate();
  };

  if (isDismissed || open !== id) return null;

  return createPortal(
    <TutorialOverlay callouts={CALLOUTS[id]} onClose={close} onHideAll={hideAll} />,
    document.body,
  );
}

function TutorialOverlay({
  callouts,
  onClose,
  onHideAll,
}: {
  callouts: readonly Callout[];
  onClose: () => void;
  onHideAll: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layout = useTutorialLayout(rootRef, callouts);

  // Escape does what the X does, and using a target does too. On `window`, in
  // the capture phase, and never stopped: the press carries on to the control
  // (the pin's menu opens, the link navigates, the drawer slides out) and the
  // overlay is simply gone by the time it lands. Pointer down rather than
  // click, so a drag straight off the pin button starts with the scrim away.
  useEffect(() => {
    // Every control an arrow can point at, as one `closest()` selector.
    const targets = callouts
      .flatMap((callout) => callout.targets)
      .map((target) => `[data-tutorial="${target.selector}"]`)
      .join(", ");

    const isOnTarget = (event: Event) =>
      event.target instanceof Element && event.target.closest(targets) !== null;

    const onPointerDown = (event: PointerEvent) => {
      if (isOnTarget(event)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if ((event.key === "Enter" || event.key === " ") && isOnTarget(event)) onClose();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [callouts, onClose]);

  return (
    <motion.div
      ref={rootRef}
      // Not `aria-modal`, and Tab is not trapped: the two targets are outside
      // this element, and a keyboard has to be able to reach them too.
      role="dialog"
      aria-label="Getting started"
      aria-describedby={callouts.map((callout) => `tutorial-note-${callout.id}`).join(" ")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none fixed inset-0 z-[60]"
    >
      <div
        aria-hidden="true"
        style={layout ? { clipPath: scrimClipPath(layout.callouts, layout.viewport) } : undefined}
        className="pointer-events-auto absolute inset-0 bg-black/10"
      />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full text-accent"
      >
        {layout?.callouts.map((callout) => (
          <ScribbleArrow key={callout.id} callout={callout} />
        ))}
      </svg>

      {callouts.map((callout) => {
        const placed = layout?.callouts.find((entry) => entry.id === callout.id);
        const copy = callout.targets[placed?.variant ?? 0];

        return (
          <TutorialNote
            key={callout.id}
            id={callout.id}
            describedBy={`tutorial-note-${callout.id}`}
            title={copy.title}
            body={copy.body}
            position={placed?.note}
          />
        );
      })}

      {/* Bottom right, not top right: the maps list's Create map sits in the
          top-right corner, and a second button there landed squarely on the
          one control that overlay asks the owner to press. No overlay points at
          anything in this corner, on any page or width. */}
      <div className="pointer-events-auto absolute right-3 bottom-3 flex gap-2">
        <IconButton
          label="Don't show tips again"
          icon={EyeOff}
          size="md"
          variant="secondary"
          placement="top"
          iconClassName="size-5"
          onPress={onHideAll}
          className="shadow-md"
        />
        <Button
          isIconOnly
          autoFocus
          aria-label="Close tutorial"
          variant="secondary"
          onPress={onClose}
          className="shadow-md"
        >
          <X aria-hidden="true" className="size-5" />
        </Button>
      </div>
    </motion.div>
  );
}
