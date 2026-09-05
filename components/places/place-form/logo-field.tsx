"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
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
 */
export function LogoField({
  value,
  onChange,
}: {
  value: LogoDraft;
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

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">Logo</span>

      <div className="flex flex-wrap gap-2">
        {value ? (
          <div className="relative">
            {/*
              A native button wrapping the preview, so the tile *is* the replace
              control — see the docblock. Not HeroUI's, for the reason
              `pin-tile.tsx` gives, and `type="button"` because this sits inside
              the place form and a bare button submits it.
            */}
            <button
              type="button"
              aria-label="Replace the logo"
              title="Replace the logo"
              onClick={() => input.current?.click()}
              className="block cursor-pointer rounded-lg ring-1 ring-border transition-colors hover:ring-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              {/* A plain img, not next/image: half of these are object URLs,
                  which the optimiser cannot fetch at all. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.url}
                alt="Logo"
                width={80}
                height={80}
                className="size-20 rounded-lg bg-surface-secondary object-contain p-1.5"
              />
            </button>

            <IconButton
              label="Remove the logo"
              icon={X}
              size="sm"
              variant="secondary"
              className="absolute -right-1.5 -top-1.5"
              iconClassName="size-3"
              onPress={() => {
                release();
                setRejected(null);
                onChange(null);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            aria-label="Add a logo"
            title="Add a logo"
            onClick={() => input.current?.click()}
            className="grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        )}
      </div>

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

      <p className="text-xs text-muted">
        JPG, PNG, WebP or AVIF, up to {kilobytes(MAX_LOGO_BYTES)}KB. Shown on the
        card wherever its design puts a Logo block. It uploads when you save.
      </p>

      {rejected ? <p className="text-xs text-danger">{rejected}</p> : null}
    </div>
  );
}

function kilobytes(bytes: number): number {
  return Math.round(bytes / 1024);
}
