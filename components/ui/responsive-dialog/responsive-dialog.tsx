"use client";

import { Drawer, Modal } from "@heroui/react";
import type { ReactNode } from "react";

import { SM_BREAKPOINT, useMediaQuery } from "@/lib/ui/use-media-query";
import { DialogShellContext } from "./context";
import { DialogBody, DialogFooter, DialogHeader, DialogHeading } from "./parts";

export type ResponsiveDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
  /** On the backdrop — where `steady` goes, since a dialog portals out of the page that set it. */
  className?: string;
  /** On the dialog in both shells. Width classes stay `sm:`-prefixed, so they are inert in the drawer. */
  dialogClassName?: string;
  /** On the drawer's dialog only — a definite height, say, for a form whose folds would otherwise walk the footer. */
  drawerClassName?: string;
  /** The modal's `scroll`. The drawer always scrolls its body. */
  scroll?: "inside" | "outside";
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  /** False hides the close button — while something that must not be interrupted is running. */
  showCloseTrigger?: boolean;
};

/**
 * A dialog on a wide screen, a bottom sheet on a phone. **Every dialog in the
 * app goes through this**, not through `Modal` directly.
 *
 * A centred modal on a 360px screen is a full-screen takeover with rounded
 * corners; a sheet that rises from the bottom edge and can be flicked away is
 * how everything else on that phone behaves. HeroUI's Drawer is that sheet, with
 * the drag-to-dismiss built in (and switched off by `isDismissable={false}`), so
 * this is a switch rather than a gesture of its own. The pin studio and Edit
 * location made the same switch by hand first; they keep theirs, because their
 * sheets have tuned heights and layouts of their own.
 *
 * One of the two is rendered, never both — two React Aria overlays with two focus
 * traps — which is why this reads `useMediaQuery` where the rest of the app
 * branches in CSS. The server answers "narrow", but a dialog cannot be open
 * before hydration, so nothing is drawn on the wrong side of that answer.
 *
 * `Drawer.Handle` is the grab bar: drag-to-dismiss ignores presses that start in
 * the body, so without it there is nothing on the sheet to pull.
 */
export function ResponsiveDialog({
  isOpen,
  onOpenChange,
  children,
  className,
  dialogClassName,
  drawerClassName,
  scroll,
  isDismissable,
  isKeyboardDismissDisabled,
  showCloseTrigger = true,
}: ResponsiveDialogProps) {
  const isWide = useMediaQuery(SM_BREAKPOINT);

  if (isWide) {
    return (
      <DialogShellContext value="modal">
        <Modal.Backdrop
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          isDismissable={isDismissable}
          isKeyboardDismissDisabled={isKeyboardDismissDisabled}
          className={className}
        >
          <Modal.Container scroll={scroll}>
            <Modal.Dialog className={dialogClassName}>
              {showCloseTrigger ? <Modal.CloseTrigger /> : null}
              {children}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </DialogShellContext>
    );
  }

  return (
    <DialogShellContext value="drawer">
      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        isDismissable={isDismissable}
        isKeyboardDismissDisabled={isKeyboardDismissDisabled}
        className={className}
      >
        {/* `max-h-full` against HeroUI's `85vh`: `vh` on a phone is the
            viewport with the browser chrome hidden, while `full` resolves
            against the visual viewport, so the sheet still fits when the
            keyboard opens. Same call as Edit location's sheet. */}
        <Drawer.Content placement="bottom" className="max-h-full">
          <Drawer.Dialog
            className={["max-h-[92dvh] pt-3", dialogClassName, drawerClassName]
              .filter(Boolean)
              .join(" ")}
          >
            <Drawer.Handle />
            {showCloseTrigger ? <Drawer.CloseTrigger /> : null}
            {children}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </DialogShellContext>
  );
}

ResponsiveDialog.Header = DialogHeader;
ResponsiveDialog.Heading = DialogHeading;
ResponsiveDialog.Body = DialogBody;
ResponsiveDialog.Footer = DialogFooter;
