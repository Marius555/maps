"use client";

import { Button, Modal } from "@heroui/react";
import { useId, useState } from "react";

import { PinImageField } from "@/components/map/pin-studio/pin-image-field";
import { ControlNote } from "@/components/ui/control-note";
import { ErrorMessage } from "@/components/ui/error-message";
import { useUpdateMap } from "@/lib/query/maps";
import { toastError } from "@/lib/query/toast-error";
import type { AppMap } from "@/lib/repositories/types";
import { ClusterIconPicker } from "./cluster-icon-picker";
import { ClusterIconPreview } from "./cluster-icon-preview";

/**
 * What nearby pins turn into when the map is zoomed out: the grey numbered
 * bubble, or one of the owner's pins or an uploaded image with the count in a
 * badge.
 *
 * Opened from the Draw menu. **This is the only writer of `maps.clusterIcon`**
 * (CLAUDE.md: one writer per column). It has a column of its own because
 * `settings` belongs to the Publish tab and `appearance` to the appearance menu.
 *
 * A choice saves the moment it is made, through `useUpdateMap`, which patches the
 * cached map first, so the clusters on the canvas behind the dialog change in the
 * same frame. There is nothing to confirm: pressing the previous tile puts it
 * back. It reaches visitors on the next publish, like every other change.
 *
 * Uploading an image sits in the footer, at the left of the row Done closes —
 * the pin builder's arrangement. The footer is one full-width child because
 * `.modal__footer` is an unlayered `flex-row justify-end`, which a `flex-col`
 * utility on the slot would lose to; the image's failures land above that row,
 * beside the control that raised them.
 */
export function ClusterIconDialog({
  map,
  isClustering,
  isOpen,
  onClose,
}: {
  map: AppMap;
  /** The Publish tab's Clustering switch. Off, no cluster is ever drawn. */
  isClustering: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const updateMap = useUpdateMap(map.id);
  const noteId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const hasImage = map.clusterIcon.startsWith("data:");

  const choose = (clusterIcon: string) => {
    if (clusterIcon === map.clusterIcon) return;

    updateMap.mutate(
      { clusterIcon },
      { onError: (error) => toastError(error, "Couldn't change the cluster icon") },
    );
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        setProblem(null);
        onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-[520px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Cluster icon</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-sm text-muted">
              When the map is zoomed out, nearby locations merge into one marker
              showing how many it holds. Choose what that marker looks like.
            </p>

            {isClustering ? null : (
              <ControlNote id={noteId}>
                Clustering is off on this map, so visitors see every pin. Turn it
                on under Publish → Map controls.
              </ControlNote>
            )}

            <ClusterIconPreview value={map.clusterIcon} pinIcons={map.pinIcons} />

            <ClusterIconPicker
              value={map.clusterIcon}
              pinIcons={map.pinIcons}
              onChange={choose}
            />
          </Modal.Body>
          <Modal.Footer>
            <div className="flex w-full flex-col gap-2">
              {problem ? <ErrorMessage error={problem} /> : null}

              <div className="flex items-center gap-2">
                <PinImageField
                  hasImage={hasImage}
                  onChange={(next) => {
                    if (next) choose(next);
                  }}
                  onProblem={setProblem}
                />

                <Button slot="close" className="ms-auto">
                  Done
                </Button>
              </div>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
