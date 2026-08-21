"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { PinField } from "@/components/places/place-form/pin-field";
import { formatCount } from "@/lib/format/number";
import type { Group } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * Gives every location in a group the same pin.
 *
 * The only way to change an existing location's pin was its edit dialog, one at
 * a time — so a group of forty stockists that turned out to want the shop glyph
 * meant forty round trips through a form. Grouping is already how the user says
 * "these are the same kind of thing"; this is the action that reads back.
 *
 * The picker is `PinField`, unchanged from the place form. A pin is a picture,
 * and the row of pictures the user already knows from editing one location is
 * the right question here too — a second, group-flavoured picker would be a
 * second thing to keep in step with the pin studio.
 *
 * **The count is stated before the button, not after.** This writes to every
 * member at once and there is no undo, so how many rows are about to change is
 * the one fact worth having in front of you while deciding.
 *
 * One dialog for the whole list, driven by which group is pending — the shape
 * `UngroupDialog` beside it uses, and for the same reason. `key` on the picker
 * is what re-seeds the local draft when the pending group changes; without it
 * the second group opened would inherit the first one's choice.
 */
export function GroupPinDialog({
  group,
  places,
  pinIcons,
  onConfirm,
  onClose,
}: {
  /** Doubles as the open state — there is no "open with no group". */
  group: Group | null;
  /** How many locations are about to change. Named in the body, not guessed. */
  places: number;
  /** The map's own pins, so `custom:<id>` ones are offered too. */
  pinIcons: CustomPinIcon[];
  onConfirm: (icon: string) => void;
  onClose: () => void;
}) {
  /*
   * Seeded blank rather than from the group's current pins, deliberately.
   * A group whose locations wear three different pins has no current pin, and
   * showing whichever one happened to be most common would be an answer to a
   * question nobody asked — and one the user could then "confirm" by accident,
   * flattening the other two.
   */
  const [icon, setIcon] = useState("");

  return (
    <Modal.Backdrop
      isOpen={group !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Pin for {group?.name}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-sm text-muted">
              Every location in this group gets this pin —{" "}
              {formatCount(places)}{" "}
              {places === 1 ? "location" : "locations"}. Any that should differ
              can be changed one at a time afterwards.
            </p>

            <PinField
              key={group?.id}
              value={icon}
              pinIcons={pinIcons}
              onChange={setIcon}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            {/* The name holds from the row's menu through to the toast (§8). */}
            <Button onPress={() => onConfirm(icon)}>Change pins</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
