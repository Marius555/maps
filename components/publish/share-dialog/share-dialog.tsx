"use client";

import { Button, Modal, Separator } from "@heroui/react";
import { Share2 } from "lucide-react";

import type { AppMap } from "@/lib/repositories/types";
import { AllowedDomainsForm } from "../allowed-domains-form";
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
 * the design. Neither form changed; only its container was ever the problem.
 */
export function ShareDialog({ map }: { map: AppMap }) {
  return (
    <Modal>
      <Button variant="secondary" size="sm" className="w-full">
        <Share2 aria-hidden="true" className="size-4" />
        Embed code and domains
      </Button>

      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[36rem]">
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Heading>Put this map on your site</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-5">
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
                    <EmbedSnippet snapshotUrl={map.snapshotUrl} />
                  </section>

                  <Separator />
                </>
              ) : (
                <p className="text-pretty text-sm text-muted">
                  Publish the map once and the embed code you paste into your
                  site will appear here.
                </p>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Allowed domains
                </h3>
                {/* Keyed on the map so switching maps re-seeds the form rather
                    than showing the previous one's saved list. */}
                <AllowedDomainsForm key={map.id} map={map} />
              </section>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
