"use client";

import Link, { useLinkStatus } from "next/link";

import type { SettingsItem } from "./settings-items";

/**
 * One settings destination.
 *
 * **"You are here" is a fill, never a weight.** The sidebar's rows go bold when
 * active, which is harmless in a column but not in the horizontal strip this
 * becomes on a phone: a bolder label is a wider label, and every item after it
 * steps sideways each time you change section. So the label is the same weight
 * in every state and only the background moves.
 */
export function SettingsNavItem({
  item,
  isActive,
}: {
  item: SettingsItem;
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex h-9 shrink-0 items-center rounded-xl px-3 text-sm whitespace-nowrap transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        isActive
          ? "bg-default text-foreground"
          : "text-muted hover:bg-default/60 hover:text-foreground"
      }`}
    >
      {item.label}
      <Pending />
    </Link>
  );
}

/**
 * Navigation feedback that takes no room.
 *
 * The sidebar puts a spinner after the label; here that would widen the row it
 * appears in. A tint laid over the row, positioned absolutely, says the same
 * thing and moves nothing. `useLinkStatus` only answers inside its own `<Link>`,
 * which is why this is a child component.
 */
function Pending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-default/70"
    />
  );
}
