"use client";

import { Drawer, Modal } from "@heroui/react";

import type { AppMap, Place } from "@/lib/repositories/types";
import { SM_BREAKPOINT, useMediaQuery } from "@/lib/ui/use-media-query";
import { PlaceForm, type FormShell } from "./place-form";

/**
 * The edit form: a dialog on a desktop, a bottom sheet on a phone.
 *
 * `place` doubles as the open state: there is no such thing as this dialog open
 * with nothing to edit, and two sources of truth would let them disagree.
 *
 * **One of the two shells is rendered, never both.** They are separate React
 * Aria overlays with separate focus traps, so rendering both and hiding one with
 * CSS would put two of them in the DOM — which is why this reaches for
 * `useMediaQuery` where the rest of the app is content with a Tailwind prefix.
 * `components/map/pin-studio/pin-studio.tsx` is the older statement of the same
 * rule, and the reason it gives holds twice as hard here: this is the largest
 * form in the app, and a centred modal on a 360px screen is a full-screen
 * takeover with rounded corners.
 *
 * The form itself is drawn once and handed whichever body and footer it is going
 * into — see `FormShell` in place-form.tsx.
 */

/*
 * Module constants, not objects built in the render.
 *
 * `PlaceForm` reads `Body` and `Footer` as component *types*. A fresh object
 * each render would be a fresh pair of types, and React unmounts and remounts a
 * subtree whose element type changed — taking focus, scroll position and every
 * keystroke since the last commit with it, once per render of a form somebody is
 * typing into.
 */
const MODAL_SHELL: FormShell = { Body: Modal.Body, Footer: Modal.Footer };
const DRAWER_SHELL: FormShell = { Body: Drawer.Body, Footer: Drawer.Footer };

export function PlaceEditDialog({
  map,
  place,
  onClose,
}: {
  map: AppMap;
  place: Place | null;
  onClose: () => void;
}) {
  const isWide = useMediaQuery(SM_BREAKPOINT);

  /* Keyed so switching locations resets the form rather than keeping the
     previous one's values. The form draws its own body and footer: the buttons
     have to be siblings of the scroller rather than the last thing inside it,
     and the `<form>` has to span both so submit still reaches them. See the
     docblock in place-form.tsx. */
  const form = place ? (
    <PlaceForm
      key={place.id}
      map={map}
      place={place}
      shell={isWide ? MODAL_SHELL : DRAWER_SHELL}
      onSaved={onClose}
      onCancel={onClose}
    />
  ) : null;

  if (isWide) {
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
          {/* Wider than a form dialog normally wants, because this one holds a
              map and two-column field rows.

              **It used to ask for `sm:max-w-1xl`, which is not a Tailwind class
              and never has been** — there is no `1xl` in the v4 container scale
              — so nothing was emitted for it and the dialog rendered at
              `.modal__dialog--md`'s 448px. That is the width the fields were
              being cramped into, and the comment here used to describe a
              stacking problem that had already been fixed elsewhere. `2xl` is
              42rem: with the dialog's own 24px padding either side, a body of
              ~624px, which is two ~300px columns.

              **The height is definite so that folds animate inside a box that does
              not move.** `.modal__dialog` is content-height until it reaches
              `max-h-full` and is centred by `sm:my-auto`, so on a display tall
              enough for the content to fit, every frame of a fold's 200ms resizes
              the dialog *and* re-centres it — the top edge creeping up by half the
              growth while the panel grows down. Two opposing motions over one
              animation. Capping the height means `Modal.Body`'s scroller has a
              fixed height and the fold is the only thing that moves. */}
          <Modal.Dialog className="h-full sm:h-[min(46rem,100%)] sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Edit location</Modal.Heading>
            </Modal.Header>
            {form}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
  }

  return (
    <Drawer.Backdrop
      isOpen={place !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Drawer.Content placement="bottom" className="max-h-full">
        {/*
          Tall, and definite, and capped against the *visible* viewport.

          Three separate decisions, none of them HeroUI's default:

          - `h-[92dvh]` rather than letting the sheet size to its content. This
            is the form with five folds, and a sheet that grew and shrank as
            each one opened would walk its own footer for 200ms at a time —
            exactly what the desktop dialog's `sm:h-[min(46rem,100%)]` exists to
            stop. 92 rather than 100 so a strip of the page stays visible: that
            is what makes it read as a sheet over something rather than a new
            screen.
          - `max-h-full` because HeroUI ships `max-height: 85vh` on a bottom
            drawer, and `vh` on a phone is the viewport with the browser chrome
            *hidden*. `full` resolves against `.drawer__content`, which HeroUI
            sizes as `height: var(--visual-viewport-height)` — so the sheet is
            capped at what is actually on screen, and shrinks correctly when the
            Android keyboard opens over it.
          - The grab bar. Drawer's drag-to-dismiss deliberately ignores presses
            that start inside the body, so without `Drawer.Handle` there is
            nothing on the sheet you can pull. Its own map field still pans,
            for the same reason.
        */}
        <Drawer.Dialog className="flex h-[92dvh] max-h-full flex-col">
          <Drawer.Handle />
          <Drawer.Header>
            <Drawer.Heading className="text-sm font-semibold">
              Edit location
            </Drawer.Heading>
          </Drawer.Header>
          {form}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
