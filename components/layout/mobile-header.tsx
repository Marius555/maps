"use client";

import { usePathname } from "next/navigation";

import type { PlanId } from "@/lib/repositories/plan-limits";
import { MobileBrand } from "./mobile-brand";
import { MobileHeaderSlot } from "./mobile-header-slot";
import { NavMenuButton } from "./nav-menu-button";

/**
 * The map editor, `/maps/<id>` and nothing under it. The Locations, Card,
 * Publish and Analytics tabs are deeper paths and keep the header.
 */
const EDITOR_PATH = /^\/maps\/[^/]+\/?$/;

/**
 * Mobile-only header.
 *
 * Deliberately has no desktop counterpart. With a sidebar carrying navigation and
 * each page carrying its own title, a desktop top bar would be a third horizontal
 * band with nothing in it — which is what "a second navbar" looked like. Below
 * `md` there's nowhere else to put the menu trigger, so it exists only there.
 *
 * No bottom border: the header shares the page background, so the chrome reads as
 * one surface instead of a stack of strips.
 *
 * The far end of the row is a slot (`MobileHeaderSlot`), so a page that has one
 * thing to open can put its trigger on this line instead of growing a bar of its
 * own — the card designer's panel is the first. Empty on every other page, which
 * costs a flex box with nothing in it.
 *
 * **Not on the map editor.** There the locations sheet's peek strip carries the
 * same three things — the hamburger at one end, the name and plan at the other
 * (`LocationsDrawer`) — and the 3.5rem this band would take goes to the map.
 * Decided from the path rather than by the page switching it off from an
 * effect, because the path is known on the server: the editor's first paint
 * already has no header, where an effect would draw one and then take it away.
 */
export function MobileHeader({ plan }: { plan: PlanId }) {
  const pathname = usePathname();
  if (EDITOR_PATH.test(pathname)) return null;

  return (
    <header className="flex min-h-14 items-center gap-2 px-2 md:hidden">
      <NavMenuButton />
      <MobileBrand plan={plan} />
      <MobileHeaderSlot />
    </header>
  );
}
