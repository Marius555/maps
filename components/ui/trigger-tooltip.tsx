"use client";

import { Tooltip } from "@heroui/react";
import { type ReactNode, useState } from "react";

/**
 * A hover label for a button that opens a popover.
 *
 * `IconButton` cannot be that button: its tooltip is uncontrolled, and a
 * tooltip on a popover trigger stays up over the panel it just opened. This one
 * is controlled, and `isSuppressed` — the popover being open, a pin being
 * dragged out — takes it down and keeps it down.
 *
 * The open state is reset *during render* when suppression starts, not merely
 * masked. Masked, the tooltip would still believe it was open, and the moment
 * the panel closed the label would pop back up over a control the user has
 * already finished with.
 *
 * The child must be the Button itself (or something that renders it), with no
 * focusable element between: the tooltip's trigger props and the popover's
 * press responder both reach it through context.
 */
export function TriggerTooltip({
  label,
  isSuppressed = false,
  placement = "bottom",
  children,
}: {
  label: string;
  isSuppressed?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (isSuppressed && isOpen) setIsOpen(false);

  return (
    <Tooltip delay={0} isOpen={isOpen && !isSuppressed} onOpenChange={setIsOpen}>
      {children}
      <Tooltip.Content placement={placement}>{label}</Tooltip.Content>
    </Tooltip>
  );
}
