"use client";

import { Spinner } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** True for index routes, so `/maps` doesn't stay lit inside `/maps/[id]`. */
  exact?: boolean;
};

/**
 * One sidebar row.
 *
 * Active state is weight plus a quiet fill — no accent bar and no coloured
 * background. The accent is reserved for things you can press; using it for
 * "you are here" makes every page look like it has a primary action in the nav.
 */
export function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  /** Closes the mobile drawer once a destination is chosen. */
  onNavigate?: () => void;
}) {
  const { icon: Icon, label, href } = item;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? label : undefined}
      className={`flex min-h-9 items-center gap-2.5 rounded-2xl px-2.5 text-sm transition-colors ${
        isActive
          ? "bg-default font-medium text-foreground"
          : "text-muted hover:bg-default/60 hover:text-foreground"
      } ${isCollapsed ? "justify-center" : ""}`}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />

      {isCollapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <NavPending />
        </>
      )}
    </Link>
  );
}

/**
 * Navigation feedback.
 *
 * `useLinkStatus` only reports for the `<Link>` it is rendered inside, which is
 * why this is a child component rather than a hook call in the item itself. Every
 * dashboard route hits Appwrite before it can render, so without this a click
 * looks like nothing happened — half of the "huge delay" complaint was the
 * absence of any acknowledgement.
 */
function NavPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return <Spinner size="sm" aria-label="Loading" className="shrink-0" />;
}
