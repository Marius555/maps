"use client";

import { usePathname } from "next/navigation";

import { SETTINGS_ITEMS } from "./settings-items";
import { SettingsNavItem } from "./settings-nav-item";

/**
 * The list of settings sections: a column beside the content from `md` up, a
 * strip that scrolls sideways above it on a phone.
 *
 * **Links, not HeroUI `Tabs`.** These are four pages with four URLs, which is a
 * `<nav>` of links, not a tablist over panels. And `Tabs` takes its orientation
 * as a prop, so changing it at a breakpoint would mean reading the viewport in
 * JavaScript — the server cannot know it, and the page would render one layout
 * and hydrate into the other. Here the switch is CSS alone, correct on the
 * first paint.
 *
 * The strip bleeds to the page edge (`-mx-4 px-4`) so a label that runs off
 * screen reads as "more this way" rather than as clipped.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="md:sticky md:top-6 md:w-44 md:shrink-0 md:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {SETTINGS_ITEMS.map((item) => (
          <li key={item.href} className="shrink-0">
            <SettingsNavItem item={item} isActive={pathname.startsWith(item.href)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
