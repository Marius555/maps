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
  /**
   * Opens in a new tab instead of replacing the dashboard.
   *
   * For destinations outside the app shell — the guides live in the marketing
   * layout, so navigating there in place swaps the whole chrome out from under
   * somebody who was mid-task and makes Back the only way home.
   */
  newTab?: boolean;
  /** What the onboarding overlays find this row by (`data-tutorial`). */
  tutorialTarget?: string;
  /**
   * How many new things are behind this row — Notifications' unread count.
   * Nothing is drawn at zero or when absent.
   */
  badge?: number;
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
  const { icon: Icon, label, href, newTab, tutorialTarget, badge = 0 } = item;
  const name = badge > 0 ? `${label}, ${badge} new` : label;

  return (
    <Link
      href={href}
      data-tutorial={tutorialTarget}
      onClick={onNavigate}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? name : undefined}
      /*
       * Named explicitly rather than by its contents. The visible label is a
       * zero-width element when collapsed, and whether a browser keeps a
       * zero-area node in the accessibility tree is not something to bet a
       * nav item's only name on.
       */
      aria-label={newTab ? `${name} (opens in a new tab)` : name}
      className={`flex min-h-9 items-center rounded-2xl px-2.5 text-sm transition-[color,background-color] duration-[var(--duration-fast)] ${
        isActive
          ? "bg-default font-medium text-foreground"
          : "text-muted hover:bg-default/60 hover:text-foreground"
      } ${isCollapsed ? "justify-center gap-0" : "gap-2.5"}`}
    >
      <span className="relative flex shrink-0">
        <Icon aria-hidden="true" className="size-5" />
        {/* The count has nowhere to go on the collapsed rail, so a dot on the
            icon says "something new" and the row's name says how much. */}
        {badge > 0 && isCollapsed ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-background"
          />
        ) : null}
      </span>

      {/*
       * Collapsed to zero width rather than swapped for an `sr-only` span. The
       * label is still in the accessibility tree at `opacity: 0`, so nothing is
       * lost, and the rail no longer pops its text out a frame before the panel
       * starts narrowing.
       */}
      <span
        className={`min-w-0 flex-1 truncate transition-[max-width,opacity] duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] ${
          isCollapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
        }`}
      >
        {label}
      </span>

      {badge > 0 && !isCollapsed ? <NavBadge count={badge} /> : null}

      {/* Nothing to wait for when the destination is another tab — this one
          never navigates, so `useLinkStatus` would report a pending state that
          has no end. */}
      {newTab ? null : <NavPending />}
    </Link>
  );
}

/**
 * The count at the end of a row. Accent, because it is the one thing in the nav
 * that asks to be pressed; capped so a long-unread account does not widen it.
 * Hidden from assistive tech — the row's own name already says the number.
 */
function NavBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="min-w-5 shrink-0 rounded-full bg-accent px-1.5 text-center text-xs font-medium leading-5 text-accent-foreground tabular-nums"
    >
      {count > 99 ? "99+" : count}
    </span>
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
