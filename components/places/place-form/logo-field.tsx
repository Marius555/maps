"use client";

import { Button, CloseButton, Description, Label } from "@heroui/react";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  ALLOWED_PHOTO_TYPES,
  MAX_LOGO_BYTES,
} from "@/lib/validation/photo";

/**
 * What this field is holding at any moment: the logo already on the row, a file
 * picked but not yet sent, or nothing.
 *
 * `PhotoSlot`'s single-valued cousin, and deliberately not a reuse of it. That
 * type carries an id *and* a url because the gallery has to reorder saved
 * photos and name one of them the cover; a logo has neither problem, and the
 * third state — "the user cleared the one that was there" — has no equivalent
 * over there, where clearing is removing a slot from a list.
 */
export type LogoDraft =
  /** What the row holds. `url` is the public storage URL. */
  | { kind: "saved"; url: string }
  /** Picked, not yet uploaded. `url` is an object URL for the preview. */
  | { kind: "new"; file: File; url: string }
  | null;

/**
 * A location's own brand mark, as a draft.
 *
 * **A draft, like the gallery beside it**, for the reason
 * `photo-gallery-field.tsx` sets out at length: a control that uploads the
 * instant it is pressed makes Cancel mean "discard everything except the logo",
 * and a Save button that does not save half of what is on screen. Nothing here
 * writes; `place-form.tsx` sends it through `useSavePlaceLogo` on submit.
 *
 * **One tile, and it replaces rather than appends.** A location has one logo, so
 * picking a second is not an addition — the picker is the tile itself once there
 * is something in it, which is what makes "replace" the obvious gesture and
 * leaves the × meaning only "remove".
 *
 * `object-contain` on a plain ground, not `cover`: a logo cropped to a square is
 * a logo with its edges cut off, and most of them are not square.
 *
 * HeroUI's `Button` for both tiles and its `CloseButton` for the ×. They were
 * native buttons, citing `pin-tile.tsx` — but that reason is the drag gesture
 * `usePress` would swallow, and nothing here drags. 64px, the same as a photo
 * thumbnail, so the two sit on one line in the place form's media fold.
 */
export function LogoField({
  value,
  hideHint,
  onChange,
}: {
  value: LogoDraft;
  /**
   * Leaves the format-and-size line to the caller. The place form draws one line
   * under the logo and the gallery together, rather than two paragraphs saying
   * the same four formats.
   */
  hideHint?: boolean;
  onChange: (next: LogoDraft) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  /*
   * The object URL this field is still holding, released when it goes away.
   *
   * A ref rather than an effect keyed on `value`, which would revoke a URL in
   * the very render that created it — the same trap, and the same answer, as the
   * gallery next door. A draft swapped for another is revoked in `accept`; this
   * covers closing the dialog, which is the case that would otherwise leak on
   * every Cancel.
   */
  const live = useRef(value);
  useEffect(() => {
    live.current = value;
  });
  useEffect(
    () => () => {
      if (live.current?.kind === "new") URL.revokeObjectURL(live.current.url);
    },
    [],
  );

  const release = () => {
    if (value?.kind === "new") URL.revokeObjectURL(value.url);
  };

  /*
   * Checked here as a courtesy and again in the repository as the guarantee
   * (CLAUDE.md §9). Doing it here is what turns "your save failed" into a
   * sentence naming what was wrong, before anything is uploaded.
   */
  const accept = (file: File) => {
    if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setRejected(`${file.name} isn’t a JPG, PNG, WebP or AVIF.`);
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setRejected(`${file.name} is over ${kilobytes(MAX_LOGO_BYTES)}KB.`);
      return;
    }

    release();
    setRejected(null);
    onChange({ kind: "new", file, url: URL.createObjectURL(file) });
  };

  const pick = () => input.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <Label elementType="span">Logo</Label>

      {value ? (
        <div className="relative w-fit">
          {/* The tile *is* the replace control — see the docblock.
              `type="button"` because this sits inside the place form, and a
              bare button submits it. */}
          <Button
            type="button"
            variant="outline"
            isIconOnly
            aria-label="Replace the logo"
            onPress={pick}
            className="size-16 overflow-hidden rounded-lg p-0"
          >
            {/* A plain img, not next/image: half of these are object URLs,
                which the optimiser cannot fetch at all. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt="Logo"
              width={64}
              height={64}
              className="size-full bg-surface-secondary object-contain p-1.5"
            />
          </Button>

          <CloseButton
            type="button"
            aria-label="Remove the logo"
            className="absolute -right-2 -top-2 size-5 shadow-sm"
            onPress={() => {
              release();
              setRejected(null);
              onChange(null);
            }}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          isIconOnly
          aria-label="Add a logo"
          onPress={pick}
          className="size-16 rounded-lg border-dashed text-muted"
        >
          <Plus aria-hidden="true" className="size-5" />
        </Button>
      )}

      {/*
        Not wrapped in a label, deliberately: Tailwind's `sr-only` is
        `position: absolute`, so inside a portalled modal the hidden input lays
        itself out against something else entirely and the page jumps to it on
        focus. Same trap as `theme-gallery.tsx`, same fix as the gallery's.
      */}
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={ALLOWED_PHOTO_TYPES.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so picking the same file twice still fires a change.
          event.target.value = "";
          if (file) accept(file);
        }}
      />

      {hideHint ? null : (
        <Description>
          JPG, PNG, WebP or AVIF, up to {kilobytes(MAX_LOGO_BYTES)}KB. Shown on
          the card wherever its design puts a Logo block. It uploads when you
          save.
        </Description>
      )}

      {rejected ? <p className="text-xs text-danger">{rejected}</p> : null}
    </div>
  );
}

export function kilobytes(bytes: number): number {
  return Math.round(bytes / 1024);
}
