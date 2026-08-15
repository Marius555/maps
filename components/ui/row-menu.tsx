"use client";

import { Dropdown, Label } from "@heroui/react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

/**
 * Every action a list row offers, behind one control.
 *
 * The rows used to carry two or three icon buttons each, revealed on hover. That
 * scales badly in both directions: each new action is another glyph competing
 * with the name the row is actually about, and a hover-revealed control does not
 * exist at all on a touch screen — the actions were unreachable on a phone.
 *
 * So: one button, always visible, and the actions get their names back. An
 * unlabelled pencil asks the reader to guess; "Rename" does not.
 *
 * What stays outside the menu is anything that says *what kind of row this is* —
 * a location's dot, a shape's circle, a group's square and its count. Those are
 * not actions, they are the row identifying itself.
 */

export type RowMenuItem = {
  /** Stable within one menu. React Aria keys the collection on it. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Renders the item as destructive. Used for the delete entries. */
  isDanger?: boolean;
  onAction: () => void;
};

export function RowMenu({
  label,
  items,
}: {
  /** Names the button for screen readers — "Actions for Berlin Store". */
  label: string;
  items: RowMenuItem[];
}) {
  if (items.length === 0) return null;

  return (
    <Dropdown>
      {/*
       * `Dropdown.Trigger`, not a raw <button>: the trigger is wrapped in a React
       * Aria PressResponder, which warns and loses press handling unless its
       * child is a real pressable. Same trap `user-menu.tsx` documents, solved
       * here with the dedicated part rather than a reshaped Button — this one is
       * a bare icon and has no Button recipe to undo.
       *
       * Muted until the row is hovered or focused. Always present — see the file
       * comment — but a column of black dots down the sidebar would compete with
       * the names, and the names are the point.
       */}
      <Dropdown.Trigger
        aria-label={label}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] group-hover:text-foreground"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </Dropdown.Trigger>

      <Dropdown.Popover placement="bottom end" className="min-w-44">
        <Dropdown.Menu aria-label={label}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              variant={item.isDanger ? "danger" : undefined}
              onAction={item.onAction}
            >
              <item.icon aria-hidden="true" className="size-4" />
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
