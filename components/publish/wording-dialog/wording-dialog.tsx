"use client";

import { Button } from "@heroui/react";
import { PenLine } from "lucide-react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { EmbedStrings } from "@/packages/shared/embed-strings";
import { WordingForm } from "./wording-form";

/**
 * Rewording the map, one phrase at a time.
 *
 * A dialog rather than fields in the design column, and that is the lesson the
 * column already paid for: two text boxes were removed from it because a
 * full-width field per phrase is a wall in 20rem (embed-settings.schema.ts).
 * Here there are twenty-odd, read once and then left alone, which is what a
 * dialog is for — the same argument the share dialog makes.
 */
export function WordingDialog({
  language,
  strings,
  onSave,
}: {
  language: string;
  strings: EmbedStrings;
  onSave: (next: EmbedStrings) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const edited = Object.keys(strings).length;

  return (
    <>
      <Button variant="secondary" size="sm" className="w-full" onPress={() => setIsOpen(true)}>
        <PenLine aria-hidden="true" className="size-4" />
        Edit wording
        {edited > 0 ? (
          <span className="text-muted">
            {" "}
            · {edited} changed
          </span>
        ) : null}
      </Button>

      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        dialogClassName="sm:max-w-[32rem]"
      >

        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>Edit wording</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>

        <ResponsiveDialog.Body>
          <p className="mb-5 text-pretty text-sm text-muted">
            What your visitors read on the map. Publish again to put your
            changes on your site.
          </p>

          {/* Keyed so reopening after a language change seeds the form
              from that language rather than the one it first opened in. */}
          <WordingForm
            key={language}
            language={language}
            strings={strings}
            onCancel={() => setIsOpen(false)}
            onSave={(next) => {
              onSave(next);
              setIsOpen(false);
            }}
          />
        </ResponsiveDialog.Body>
      </ResponsiveDialog>
    </>
  );
}
