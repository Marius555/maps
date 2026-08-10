"use client";

import { Button, Tooltip } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * An icon-only button that is still labelled.
 *
 * `label` is mandatory and feeds both `aria-label` and the tooltip, so an
 * icon-only control can never ship without an accessible name — the failure mode
 * these invite.
 *
 * `delay={0}` because HeroUI's default is 700ms, which is far too slow for a
 * toolbar or a row action: the user has moved on before the label appears.
 */
export function IconButton({
  label,
  icon: Icon,
  variant = "tertiary",
  size = "sm",
  placement = "top",
  iconClassName = "size-4",
  ...props
}: {
  label: string;
  icon: LucideIcon;
  placement?: "top" | "bottom" | "left" | "right";
  /**
   * For the rare button that is not toolbar-sized. The geocode results put one
   * inline on a `text-xs` line, where a 16px glyph is bigger than the row.
   */
  iconClassName?: string;
} & Omit<ComponentProps<typeof Button>, "children" | "isIconOnly">) {
  return (
    <Tooltip delay={0}>
      <Button aria-label={label} isIconOnly size={size} variant={variant} {...props}>
        <Icon aria-hidden="true" className={iconClassName} />
      </Button>
      <Tooltip.Content placement={placement}>{label}</Tooltip.Content>
    </Tooltip>
  );
}
