"use client";

import { Button } from "@heroui/react";
import type { FormEvent, ReactNode } from "react";

import { ErrorMessage } from "@/components/ui/error-message";

/**
 * The chrome every slot form wears: a heading, whatever it is asking for, the
 * failure, and the two buttons.
 *
 * One file so the six bodies are each only their own fields. They differ in what
 * they collect and in which mutation they call — a photo goes through
 * `useSavePlacePhotos` and everything else through `useUpdatePlace` — but they
 * are the same shape on screen, and six hand-built footers would drift into six
 * differently-sized popovers hanging off one card.
 *
 * **A real `<form>`, so Enter submits.** These are one or two fields opened from
 * a single press; reaching for the mouse to confirm a phone number would make
 * the slot slower than the Edit dialog it exists to save.
 *
 * The verb is "Add", not "Save": the slot is only ever drawn over something this
 * location has nothing in, so there is nothing here to save yet — and an action
 * keeps its name through the whole flow (§8), which starts at the `+`.
 */
export function SlotShell({
  title,
  error,
  isPending,
  isDisabled,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  /** Whatever the mutation threw, rendered verbatim — see `ErrorMessage`. */
  error?: unknown;
  isPending?: boolean;
  /** True while there is nothing worth sending — an untouched form. */
  isDisabled?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    // `noValidate` for the reason every other form in this app carries it: the
    // browser's own bubbles say things we did not write, in a voice that is not
    // ours, and zod already has the sentence.
    <form onSubmit={submit} noValidate className="w-72 max-w-[calc(100vw-3rem)] space-y-3">
      <p className="text-sm font-medium text-foreground">{title}</p>

      {error ? <ErrorMessage error={error} /> : null}

      {children}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="tertiary" onPress={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="submit" isPending={isPending} isDisabled={isDisabled}>
          Add
        </Button>
      </div>
    </form>
  );
}
