"use client";

import { Modal } from "@heroui/react";

import type { AppMap, Place } from "@/lib/repositories/types";
import { PlaceForm } from "./place-form";

/**
 * The edit form in a modal.
 *
 * `place` doubles as the open state: there is no such thing as this dialog open
 * with nothing to edit, and two sources of truth would let them disagree.
 */
export function PlaceEditDialog({
  map,
  place,
  onClose,
}: {
  map: AppMap;
  place: Place | null;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={place !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      {/* `scroll="inside"` written out rather than left to the default, because
          the whole arrangement below depends on it: it caps the dialog at the
          viewport and gives the overflow to the body alone, which is what keeps
          the footer against the bottom edge while a fold animates shut. Same
          call, and the same reason, as the pin studio's. */}
      <Modal.Container scroll="inside">
        {/* Wider than a form dialog normally wants, because this one holds a map
            and two-column field rows. At 520px the essentials stacked into a
            single column and the map was a letterbox.

            **`sm:max-w-1xl` is not a Tailwind class and never has been** — there is
            no `1xl` in the v4 container scale — so nothing is emitted for it and the
            dialog renders at `.modal__dialog--md`'s 448px, measured. That is
            narrower than the width this comment calls broken. Left as found rather
            than guessed at: the stacking it describes is stale too (the essentials
            grid is `sm:grid-cols-1` now), so what the right width is has to be
            looked at rather than derived from here.

            **The height is definite so that folds animate inside a box that does not
            move.** `.modal__dialog` is content-height until it reaches `max-h-full`
            and is centred by `sm:my-auto`, so on a display tall enough for the
            content to fit, every frame of a fold's 200ms resizes the dialog *and*
            re-centres it — the top edge creeping up by half the growth while the
            panel grows down. Two opposing motions over one animation. Capping the
            height means `Modal.Body`'s scroller has a fixed height and the fold is
            the only thing that moves. Below `min()`'s cap nothing changes: on a
            732px viewport the dialog already measures 652px, which is exactly
            `100%` of the container's content box. */}
        <Modal.Dialog className="h-full sm:h-[min(46rem,100%)] sm:max-w-1xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Edit location</Modal.Heading>
          </Modal.Header>
          {/* The form draws its own `Modal.Body` and `Modal.Footer`: the buttons
              have to be siblings of the scroller rather than the last thing
              inside it, and the `<form>` has to span both so submit still
              reaches them. See the docblock in place-form.tsx.

              Keyed so switching locations resets the form rather than keeping
              the previous one's values. */}
          {place ? (
            <PlaceForm
              key={place.id}
              map={map}
              place={place}
              onSaved={onClose}
              onCancel={onClose}
            />
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
