"use client";

import { Button, Modal } from "@heroui/react";
import { useId, useState } from "react";

import {
  useEmailUnverified,
  VerifyEmailNotice,
} from "@/components/verify-email/verify-email-notice";
import { CreateMapForm } from "./create-map-form";

/**
 * Create map, and the one state that switches it off.
 *
 * The disable lives in here rather than at the two call sites (`map-list.tsx` and
 * `map-list-empty.tsx`) so the note can never be separated from the button it
 * explains — a grey button whose reason is elsewhere on the page is a grey
 * button, which is the mistake `lib/query/plan-limit-toast.ts` records.
 *
 * This is one of only two controls the email gate greys; the other is Publish.
 * Both are doors rather than actions — everything else an unconfirmed account
 * could try is reached through one of them — and everything deeper stays live and
 * fails honestly through the server's 403. Greying the whole app would mean
 * touching several dozen components and missing some.
 *
 * Unlike the plan limit, there is no count to show before the click, so the
 * button does not open onto an explanation: it simply does not open. That is safe
 * only because the note is right underneath it and the banner is at the top of
 * the same page.
 *
 * `align` exists because the note is wider than the button and the wrapper sizes
 * to the wider child, so without it the button visibly jumps left the moment the
 * note appears — measured in the browser, not guessed. The two call sites want
 * different answers: the toolbar row is `justify-between` and wants the button
 * kept on the right edge, the empty state centres everything it holds.
 */
const ALIGN = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
} as const;

export function CreateMapDialog({
  label = "Create map",
  variant,
  align = "start",
}: {
  label?: string;
  variant?: "primary" | "secondary" | "tertiary";
  /** Where the button sits once the note beneath it widens the column. */
  align?: keyof typeof ALIGN;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const unverified = useEmailUnverified();
  const noteId = useId();

  return (
    <div className={`flex flex-col gap-2 ${ALIGN[align]}`}>
      <Button
        variant={variant}
        onPress={() => setIsOpen(true)}
        isDisabled={unverified}
        aria-describedby={unverified ? noteId : undefined}
      >
        {label}
      </Button>

      <VerifyEmailNotice id={noteId} />

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Create map</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <CreateMapForm onCreated={() => setIsOpen(false)} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
