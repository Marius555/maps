"use client";

import { useState } from "react";

import {
  LogoField,
  type LogoDraft,
} from "@/components/places/place-form/logo-field";
import { ErrorMessage } from "@/components/ui/error-message";
import { useSavePlaceLogo } from "@/lib/query/photo";
import type { Place } from "@/lib/repositories/types";
import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import { PropertyChoice } from "@/components/ui/properties/property-fields";

/**
 * Which of its three drawings the mark is.
 *
 * The Logo block draws the location's whole pin — body, ring, and whichever of a
 * glyph or an image sits inside it — or the location's own uploaded logo. Both
 * are right for different maps, which is what the third answer is for.
 *
 * - **Pin** is what every card drawn before this control existed draws, and it
 *   is what an absent `logoMode` still means, so nothing published moves (§7).
 * - **Mixed** is the logo where a location has one and the pin where it does
 *   not. It is what a freshly dragged Logo block arrives as, because one design
 *   is drawn for every location on every map in the account and most of those
 *   are filled in differently.
 * - **Logo** is the logo and nothing else. A location without one draws an empty
 *   block — on the editor's own card, a `+` offering the upload. That is the
 *   whole difference from Mixed, and it is a real one: a brand that expects a
 *   logo on every pin wants to *see* the ones that are missing.
 *
 * `hasLogo` and `hasImage` are what keep the panel honest, and they are two
 * different marks: the first is the sample location's own upload, the second is
 * an image on the custom pin it wears, which `logoImageOf` falls back to. The
 * line under the control is said only while it is true, and as a fact about this
 * location rather than as a fault (§8).
 */
const LOGO_OPTIONS = [
  { value: "pin", label: "Pin" },
  { value: "mixed", label: "Mixed" },
  { value: "image", label: "Logo" },
] as const satisfies readonly {
  value: "pin" | "mixed" | "image";
  label: string;
}[];

/**
 * How round the mark's corners are.
 *
 * Three answers rather than a slider, for the reason every number on this panel
 * became five named tiles: nobody arranging a card is choosing 11px of roundness
 * out of a range, and the two ends are what the question is actually about.
 *
 * Square is the absence, and so is what every card drawn before this control
 * existed shows. Round is a circle, because a logo block is squared -- which
 * also means a wide wordmark loses its ends to it, since the image is
 * letterboxed rather than cropped. That is a real choice with a real cost, which
 * is why it is offered rather than guessed at.
 *
 * Only shown once the block can actually draw an image: a pin is drawn from
 * paths and is already its own shape, so on Pin these three buttons would move
 * nothing -- and a control shown is a control that takes effect
 * (`BlockProperties`).
 */
const LOGO_RADIUS_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "round", label: "Round" },
] as const satisfies readonly {
  value: "square" | "rounded" | "round";
  label: string;
}[];

export function LogoProperties({
  block,
  hasImage,
  sample,
  isOwnCard,
  mapId,
  onChange,
}: {
  block: CardBlock;
  /** Whether the *sample* location's pin carries an uploaded image. */
  hasImage: boolean;
  /** The location the canvas is drawing, or null on a map with none. */
  sample: Place | null;
  /**
   * Whether `sample` is the location whose card this panel was opened from,
   * rather than a stand-in the canvas happened to pick. See the caption below.
   */
  isOwnCard?: boolean;
  mapId: string;
  onChange: (patch: BlockPatch) => void;
}) {
  const saveLogo = useSavePlaceLogo(mapId);
  const [draft, setDraft] = useState<LogoDraft>(null);

  const mode = block.logoMode ?? "pin";
  const saved: LogoDraft = sample?.logoUrl
    ? { kind: "saved", url: sample.logoUrl }
    : null;

  /*
   * Uploads on pick rather than on a Save button, which is the opposite of the
   * Edit dialog's rule and right here for the reason that panel is: **every
   * control in this panel takes effect immediately.** There is no form around
   * it and nothing to submit, so a logo waiting for a press nobody is offered
   * would simply never be sent.
   */
  const upload = async (next: LogoDraft) => {
    setDraft(next);
    if (next?.kind !== "new" || !sample) return;

    try {
      await saveLogo.mutateAsync({ placeId: sample.id, logo: next.file });
    } catch {
      // Rendered from the mutation's own error below.
    } finally {
      // The row is the truth once the request has settled either way, and
      // `usePlaces` has already been patched with it.
      setDraft(null);
    }
  };

  return (
    <>
      <PropertyChoice
        label="Show"
        // The pin is what an untouched block draws, so that is what the control
        // has to show — not a fourth "unset" state nobody chose.
        value={mode}
        options={LOGO_OPTIONS}
        onChange={(logoMode) => onChange({ logoMode })}
      />

      {mode === "pin" ? null : (
        <PropertyChoice
          label="Corners"
          // Square is what an untouched mark draws, so that is what the control
          // has to show -- not a fourth "unset" state nobody chose.
          value={block.logoRadius ?? "square"}
          options={LOGO_RADIUS_OPTIONS}
          onChange={(logoRadius) => onChange({ logoRadius })}
        />
      )}

      {mode === "pin" || !sample ? null : (
        <>
          {/*
            The upload, here rather than only in the Edit dialog, because
            "select Logo and there is no way to add one" is exactly where
            somebody arranging a card gets stuck.

            **It writes the sample location's row, not the design.** The design
            is saved per account and drawn for every location on every map; a
            logo belongs to one location. So the label names which one, or this
            is a control that appears to set something global and does not.
          */}
          <div className="space-y-1">
            <LogoField value={draft ?? saved} onChange={(next) => void upload(next)} />

            {/*
              Said only where the sample is somebody *else*.
              
              On the studio's canvas the location being drawn is whichever row
              happened to be first, so an upload here writes a row the owner did
              not choose and the sentence is what stops that being a surprise.
              Opened from a pin's own card in edit mode, the sample *is* the
              location under the pointer -- there is nothing to warn about, and
              the sentence would be explaining the obvious back to somebody who
              just clicked it.
            */}
            {isOwnCard ? null : (
              <p className="text-xs text-muted">
                This is {sample.name || "this location"}&rsquo;s own logo. Every
                location has its own — add them in Edit location, or from the
                card on the map.
              </p>
            )}
          </div>

          {saveLogo.error ? <ErrorMessage error={saveLogo.error} /> : null}
        </>
      )}

      {mode === "image" && !sample?.logoUrl && !hasImage ? (
        <p className="-mt-1 text-xs text-muted">
          Locations with no logo draw an empty block here. Choose Mixed to draw
          their pin instead.
        </p>
      ) : null}
    </>
  );
}
