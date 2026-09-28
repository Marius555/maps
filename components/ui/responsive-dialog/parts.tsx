"use client";

import { Drawer, Modal } from "@heroui/react";
import type { ComponentProps } from "react";

import { useDialogShell } from "./context";

/**
 * The inside of a `ResponsiveDialog`: each part renders the Modal or Drawer
 * piece of the same name, whichever shell it sits in. The two share their slot
 * structure and their spacing rules (`header + body`, `body + footer`), so a
 * dialog is written once and reads right in both.
 *
 * Context rather than props, because several dialogs put their body and footer
 * in a child form component that has no idea which shell it is in.
 */

type PartProps = Omit<ComponentProps<"div">, "ref">;

export function DialogHeader(props: PartProps) {
  return useDialogShell() === "drawer" ? <Drawer.Header {...props} /> : <Modal.Header {...props} />;
}

export function DialogHeading({
  className,
  ...props
}: Omit<ComponentProps<typeof Modal.Heading>, "ref">) {
  return useDialogShell() === "drawer" ? (
    <Drawer.Heading className={className} {...props} />
  ) : (
    <Modal.Heading className={className} {...props} />
  );
}

export function DialogBody(props: PartProps) {
  return useDialogShell() === "drawer" ? <Drawer.Body {...props} /> : <Modal.Body {...props} />;
}

export function DialogFooter(props: PartProps) {
  return useDialogShell() === "drawer" ? <Drawer.Footer {...props} /> : <Modal.Footer {...props} />;
}
