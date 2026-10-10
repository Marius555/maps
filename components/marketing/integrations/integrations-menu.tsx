"use client";

import { Button, Popover } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { INTEGRATIONS } from "@/lib/marketing/integrations";
import { PlatformIcon } from "./platform-icon";

/**
 * The navbar's Integrations item: the platforms a map can go onto, each to its
 * own page.
 *
 * **A popover of links, not a HeroUI `Dropdown`.** A Dropdown is a `role=menu`
 * whose rows act through `onAction`, and an `href` row there is followed natively,
 * as a full document load (`components/layout/user-menu.tsx` has that story).
 * These are navigation, so they are real `<Link>`s: prefetched, middle-clickable,
 * and announced as links.
 *
 * **Nothing scales.** The trigger sits in `.steady`, which switches off HeroUI's
 * press shrink, and `.mk-nav-popover` (globals.css) takes the zoom out of the
 * popover's entrance and exit — a plain dropdown, asked for by the owner. The
 * same rule holds the corner arithmetic: 16px outside, 6px padding, 10px rows.
 *
 * Opens on press rather than hover, so a keyboard, a mouse and a finger all get
 * the same control. Controlled, so choosing a row closes it — a client navigation
 * keeps the header mounted, and an open popover would otherwise stay over the
 * page it just led to.
 */
export function IntegrationsMenu({ className = "" }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={`steady ${className}`}>
      <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
        {/* A HeroUI Button reshaped to read as the text links beside it:
            `Popover` wraps its trigger in a PressResponder, which needs a real
            pressable. */}
        <Button
          variant="ghost"
          className={`h-auto min-w-0 gap-1 rounded-sm bg-transparent p-0 text-sm font-normal transition-colors hover:bg-transparent hover:text-foreground ${
            isOpen ? "text-foreground" : "text-muted"
          }`}
        >
          Integrations
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
          />
        </Button>

        <Popover.Content placement="bottom" offset={14} className="mk-nav-popover">
          <Popover.Dialog aria-label="Integrations" className="w-72 p-1.5">
            <ul>
              {INTEGRATIONS.map((integration) => (
                <li key={integration.slug}>
                  <Link
                    href={integration.href}
                    onClick={() => setIsOpen(false)}
                    className="group flex items-center gap-3 rounded-[10px] p-2.5 outline-none transition-colors hover:bg-default focus-visible:bg-default"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-default text-foreground transition-colors group-hover:bg-surface group-focus-visible:bg-surface">
                      <PlatformIcon icon={integration.icon} className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {integration.name}
                      </span>
                      <span className="block text-xs text-muted">{integration.blurb}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>
    </span>
  );
}
