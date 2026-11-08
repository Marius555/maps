"use client";

import { Separator, Tabs } from "@heroui/react";
import { CodeXml, Globe } from "lucide-react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { AppMap, Place } from "@/lib/repositories/types";
import { AllowedDomainsFold } from "../allowed-domains/allowed-domains-fold";
import { useStickyMinHeight } from "./use-sticky-min-height";
import { WebsiteTab } from "./website-tab";
import { WordPressTab } from "./wordpress-tab";

type Platform = "website" | "wordpress";

const PANEL_CLASS = "col-start-1 row-start-1 mt-0 p-0 data-[inert=true]:invisible";

/**
 * The two things an owner needs *after* designing: the line they paste, and
 * where it is allowed to run.
 *
 * A dialog rather than the foot of the design column, because both are read
 * once — when the snippet is first pasted, and when a domain is locked down —
 * and a 20rem column made the snippet a `<pre>` scrolled sideways one word at
 * a time.
 *
 * **Rewritten on 2026-11-07 because it read as prose with a snippet in it**:
 * seven paragraphs — what pasting does, what the tags do, what the test page
 * is, an analytics warning, the WordPress route, what allowed domains are and
 * that they are not security — around one line of code. What is left says each
 * thing once, in the place it applies:
 *
 * - **"Embed code"**, and one line under it: paste once, every publish updates
 *   it.
 * - **Website | WordPress tabs.** The code, with its copy button in the code's
 *   own bar (`SnippetCode`); a "Show" row of tag chips with a count
 *   (`SnippetTagRow`); Open test page. WordPress is three numbered steps and
 *   the plugin, and an owner on WordPress never sees the code at all.
 * - **Allowed domains**, folded, with one hint line inside.
 *
 * Two ways in, both from the Publish footer's steppers:
 *
 * - **Outside Shopify it is opened from outside** (`isOpen` / `onOpenChange`),
 *   by the "Your website" stepper's Get embed code (`WebsiteStepper`), whose
 *   step counts as done once the snippet is copied (`onSnippetCopied`).
 * - **Inside the Shopify admin** the store is the obvious place for the map, so
 *   `trigger="link"` draws one quiet line, "Embed on another site", at the foot
 *   of the storefront stepper (`StorefrontStepper`) — the name the "site list
 *   is full" toasts there use.
 */
export function ShareDialog({
  map,
  places,
  trigger = "none",
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSnippetCopied,
}: {
  /** `"none"`: no trigger of its own; the caller opens it with `isOpen`. */
  trigger?: "none" | "link";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  /** Copy embed code reached the clipboard. */
  onSnippetCopied?: () => void;
  map: AppMap;
  /** For the tag chips: which tags anybody wears, and how many each shows. */
  places: Place[];
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = controlledOpen ?? ownOpen;
  const setIsOpen = controlledOnOpenChange ?? setOwnOpen;
  const [platform, setPlatform] = useState<Platform>("website");
  const panelsRef = useStickyMinHeight<HTMLDivElement>();

  return (
    <>
      {trigger === "link" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 rounded text-xs text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          <CodeXml aria-hidden="true" className="size-3.5" />
          Embed on another site
        </button>
      ) : null}

      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        dialogClassName="sm:max-w-[36rem]"
      >
        <ResponsiveDialog.Header className="gap-1">
          <ResponsiveDialog.Heading>Embed code</ResponsiveDialog.Heading>
          <p className="text-sm text-muted">
            {map.snapshotUrl
              ? "Paste it once — every publish updates it."
              : "Publish your map first — its embed code appears here."}
          </p>
        </ResponsiveDialog.Header>

        <ResponsiveDialog.Body className="space-y-5">
          {/*
           * Only once there is something to paste. Before the first publish
           * there is no snapshot for a snippet to point at, and a snippet
           * naming a file that does not exist is a broken map on somebody's
           * site rather than a head start.
           */}
          {map.snapshotUrl ? (
            <>
              <Tabs
                className="w-full gap-4"
                selectedKey={platform}
                onSelectionChange={(key) => setPlatform(key as Platform)}
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Where the map goes">
                    <Tabs.Tab id="website" className="gap-2">
                      <Globe aria-hidden="true" className="size-4 shrink-0" />
                      Website
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="wordpress" className="gap-2">
                      <WordPressMark />
                      WordPress
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>

                {/* Both panels mounted and stacked in one grid cell, the hidden
                    one `invisible`, so the dialog is the height of the taller
                    and does not jump on its centre line when the tab changes.
                    The sticky min-height covers the one commit in which React
                    Aria drops the old panel — see `useStickyMinHeight`. */}
                <div ref={panelsRef} className="grid">
                  <Tabs.Panel
                    id="website"
                    shouldForceMount
                    className={PANEL_CLASS}
                  >
                    <WebsiteTab
                      snapshotUrl={map.snapshotUrl}
                      tagGroups={map.tagGroups}
                      places={places}
                      onCopied={onSnippetCopied}
                    />
                  </Tabs.Panel>
                  <Tabs.Panel
                    id="wordpress"
                    shouldForceMount
                    className={PANEL_CLASS}
                  >
                    <WordPressTab />
                  </Tabs.Panel>
                </div>
              </Tabs>

              <Separator />
            </>
          ) : null}

          {/* Keyed on the map so switching maps re-seeds the list rather
              than showing the previous one's saved domains. */}
          <AllowedDomainsFold key={map.id} map={map} />
        </ResponsiveDialog.Body>
      </ResponsiveDialog>
    </>
  );
}

/** A plain "W" in a ring — lucide has no WordPress mark, and a brand logo is not ours to redraw. */
function WordPressMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-current text-[9px] leading-none font-bold"
    >
      W
    </span>
  );
}
