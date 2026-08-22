"use client";

import { Button, Modal } from "@heroui/react";

import { ErrorMessage } from "@/components/ui/error-message";
import { formatCount } from "@/lib/format/number";
import type { Group } from "@/lib/repositories/types";

/**
 * Confirms deleting a group and everything inside it.
 *
 * The dangerous twin of `UngroupDialog`, and the two are deliberately not one
 * control with a checkbox. "Take this bundle apart" and "destroy forty
 * locations" are different intentions, and a single button that did whichever a
 * tickbox last said would put the irreversible one a mis-click from the safe one.
 *
 * So this one is red, it counts out loud what is about to go, and its cancel
 * button says "Keep them" rather than "Cancel" — the same treatment deleting a
 * location gets, for the same reason: at the moment of reading, the useful word
 * is the outcome, not the mechanic.
 *
 * The counts are passed in rather than derived here, and the caller reads them
 * off the live arrays — so a location dragged into the group while this is open
 * is included in both the sentence and the delete.
 *
 * One dialog for the whole list, driven by which group is pending. A dialog per
 * row would mean a modal per group on every map.
 */
export function DeleteGroupDialog({
  group,
  places,
  shapes,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: {
  /** Doubles as the open state — there is no "open with nothing to delete". */
  group: Group | null;
  places: number;
  shapes: number;
  isDeleting: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const total = places + shapes;

  return (
    <Modal.Backdrop
      isOpen={group !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Delete {group?.name} and its contents?</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <p className="text-sm text-muted">
              {contentsSentence(places, shapes)} This can&rsquo;t be undone.
            </p>
            {/* The same caveat every delete here carries. A map stays as it was
                published until it is published again, and someone who deletes
                forty locations and then checks their website needs to know that
                before they conclude nothing happened. */}
            <p className="text-sm text-muted">
              If the map is published, they stay visible to visitors until you
              publish again.
            </p>
            {error ? <ErrorMessage error={error} /> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Keep them
            </Button>
            <Button variant="danger" isPending={isDeleting} onPress={onConfirm}>
              {/* The count rides onto the button itself: it is the last thing
                  read before the press, and "Delete 49" is a much harder thing
                  to press by accident than "Delete". */}
              {total > 0 ? `Delete ${formatCount(total)}` : "Delete group"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * What is inside, in words.
 *
 * Spelled out rather than assembled from a generic pluraliser because an empty
 * group has to read as a sentence too — "0 locations and 0 shapes will be
 * permanently deleted" is a strange thing to say about a group that holds
 * nothing, and that is a real state: the row is still there to be tidied away.
 */
function contentsSentence(places: number, shapes: number): string {
  const parts: string[] = [];

  if (places > 0) {
    parts.push(`${formatCount(places)} ${places === 1 ? "location" : "locations"}`);
  }
  if (shapes > 0) {
    parts.push(`${formatCount(shapes)} ${shapes === 1 ? "shape" : "shapes"}`);
  }

  if (parts.length === 0) {
    return "This group is empty, so only the group itself goes.";
  }

  return `The group and the ${parts.join(" and ")} in it will be permanently deleted.`;
}
