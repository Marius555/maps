"use client";

import { Button, Separator } from "@heroui/react";
import { Share2 } from "lucide-react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { AppMap, Place } from "@/lib/repositories/types";
import { AllowedDomainsFold } from "../allowed-domains/allowed-domains-fold";
import { EmbedSnippet } from "../embed-snippet";

/**
 * The two things an owner needs *after* designing: the line they paste, and
 * where it is allowed to run.
 *
 * Both were folded into the foot of the design column, and both were wrong there
 * for the same reason: they are read once each — when the snippet is first
 * pasted, and when a domain is locked down — against controls somebody adjusts
 * for as long as they are on the page. A 20rem column then made the snippet a
 * `<pre>` scrolled sideways one word at a time and the domain list a textarea
 * three characters wide.
 *
 * A dialog gives them the width they always needed and gives the column back to
 * the design.
 *
 * The domains have since become a fold of their own, entered one at a time
 * (`allowed-domains/`), and the tag chips offer only tags somebody wears and
 * say how many locations the choice shows.
 */
export function ShareDialog({
  map,
  places,
  isMeasuring,
}: {
  map: AppMap;
  /** For the tag chips: which tags anybody wears, and how many each shows. */
  places: Place[];
  /**
   * The measurement switch as the sidebar's draft has it — for the wording of the
   * test page's warning, and nothing else. What is actually being recorded lives
   * in the published snapshot, which the test page reads for itself.
   */
  isMeasuring: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" className="w-full" onPress={() => setIsOpen(true)}>
        <Share2 aria-hidden="true" className="size-4" />
        Embed code and domains
      </Button>

      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        dialogClassName="sm:max-w-[36rem]"
      >

        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>Put this map on your site</ResponsiveDialog.Heading>
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
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Embed code
                </h3>
                <EmbedSnippet
                  snapshotUrl={map.snapshotUrl}
                  isMeasuring={isMeasuring}
                  tagGroups={map.tagGroups}
                  places={places}
                />
              </section>

              <Separator />
            </>
          ) : (
            <p className="text-pretty text-sm text-muted">
              Publish the map once and the embed code you paste into your
              site will appear here.
            </p>
          )}

          {/* Keyed on the map so switching maps re-seeds the list rather
              than showing the previous one's saved domains. */}
          <AllowedDomainsFold key={map.id} map={map} />
        </ResponsiveDialog.Body>
      </ResponsiveDialog>
    </>
  );
}
