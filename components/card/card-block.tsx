"use client";

import { Chip, Disclosure, Separator } from "@heroui/react";
import { Globe, ImageOff, ImagePlus, Mail, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useState } from "react";


import { NO_DRAG_PROPS } from "@/components/groups/use-row-drag";
import { PinPreview } from "@/components/map/pin-preview";
import { PlaceCardHours } from "@/components/map/place-card/place-card-hours";
import { isEmptyHours } from "@/packages/shared/hours";
import type { MapCategory, MapField, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { CardBlockType } from "@/packages/shared/card-layout";

/**
 * One block of a location card, in React.
 *
 * The twin of the `BUILDERS` table in embed/src/popup.ts, and the two are held
 * together by the layout they both read rather than by this file resembling that
 * one — the embed builds DOM nodes by hand because it must not ship React, and
 * this uses the dashboard's own components because it should. What has to match
 * is *what a block is*, not how it is made.
 *
 * That licence is spent here, deliberately and in three places: the category is
 * a HeroUI `Chip`, the fold is a HeroUI `Disclosure` where the embed keeps a
 * bare `<details>`, and the ways to reach a place are buttons rather than lines
 * of text. None of them changes what the block *is*, and the embed cannot have
 * any of them — HeroUI is React, and §4 closes the whole library to it.
 *
 * Every block returns null when this location has nothing to put in it, which is
 * what lets one layout be right for three thousand locations that are each
 * filled in differently.
 */

export type CardBlockData = {
  place: Place;
  category: MapCategory | undefined;
  fields: MapField[];
  /**
   * The map's own pins, which is where the Logo block's picture comes from.
   *
   * A logo is not a second upload — it is the mark the owner already made in Pin
   * studio, drawn large. That is what keeps it per-location with no new field on
   * a place, no new bucket, and nothing new in a published snapshot: the pins are
   * already there, images inlined, because the map draws them.
   */
  pinIcons: CustomPinIcon[];
  /** What "More details" holds — see `detailsContents`. */
  folded: CardBlockType[];
  /**
   * Whether this card is being drawn on the designer canvas rather than shown
   * to someone.
   *
   * Three blocks need to know, and they need to know it for the same reason:
   * the designer's card must stay *selectable and draggable*, which a block
   * that collapses to nothing, opens a website, or draws no pixels at all is
   * not. It is a flag rather than the presence of `onSampleImage`, which is
   * what this used to be inferred from — true, but it says nothing about why,
   * and it tied "can this block be arranged" to "is there a photo to stand in".
   *
   * Never set by `CardView`, and the embed builds its own DOM, so nothing here
   * can reach a visitor.
   */
  isDesigner?: boolean;
  /**
   * A designer-only stand-in photo, for a gallery block on a sample location
   * that has none of its own — see `CardCanvas`, the only caller that ever
   * sets either of these two fields. Never uploaded, never written to the
   * layout or any place record: `CardView` — the live dashboard popup, and the
   * shape the embed is checked against — never receives them, so a real
   * visitor can never see an invented photo.
   */
  sampleImageUrl?: string | null;
  /** Present only in the designer, where there is somewhere to save one to. */
  onSampleImage?: (file: File) => void;
};

export function CardBlockContent({
  type,
  data,
}: {
  type: CardBlockType;
  data: CardBlockData;
}) {
  const { place, category, fields } = data;

  switch (type) {
    case "gallery":
      return (
        <Gallery
          place={place}
          sampleImageUrl={data.sampleImageUrl}
          onSampleImage={data.onSampleImage}
        />
      );

    case "logo":
      /*
       * The location's own pin, drawn at the size its block was given.
       *
       * `PinPreview` and not a new drawing: the pin a customer designed, the
       * marker on the map, the tile they pressed to design it and this are one
       * `pinSvg` rendered in four places. A pin carrying an uploaded image is a
       * logo; one carrying a glyph is the mark that map uses for this kind of
       * place. Both are the right answer to "what is this location's badge",
       * which is why there is no empty state here.
       *
       * No `color` prop — that override belongs to a group, and a card is not
       * looking at one. The category is the fallback, exactly as it is on the
       * map: the pin's own colour first, the category's if it has none.
       */
      return (
        <PinPreview
          icon={place.icon}
          pinIcons={data.pinIcons}
          fallbackColor={category?.color}
          size="fill"
        />
      );

    case "name":
      return (
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {place.name}
        </h3>
      );

    case "category":
      /*
       * A chip rather than the `CategoryBadge` the lists use, and the swap is
       * only here: a badge in a table row is a label beside forty other labels,
       * while on a card it is the one thing saying what kind of place this is,
       * and it should read as a thing rather than as a line of small print.
       *
       * The colour dot stays. It is the same colour as the pin the visitor just
       * clicked, which is the whole point of it — and colour still never carries
       * the meaning alone, because the label is always beside it.
       */
      return category ? (
        <Chip size="sm" variant="soft" className="max-w-full">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: category.color }}
          />
          <Chip.Label className="truncate">{category.label}</Chip.Label>
        </Chip>
      ) : null;

    case "address":
      return place.address ? (
        // Two lines, then an ellipsis. A full address is what this line is for,
        // and truncating after one hid the half that says which town.
        <p className="line-clamp-2 text-xs text-muted">{place.address}</p>
      ) : null;

    case "description":
      return place.description ? (
        <p className="text-xs whitespace-pre-line text-foreground">
          {place.description}
        </p>
      ) : null;

    case "hours":
      return <PlaceCardHours hours={place.hours} />;

    case "fields":
      return <FieldRows place={place} fields={fields} />;

    case "details":
      return <Details data={data} />;

    case "actions":
      return (
        <Actions place={place} fields={fields} isDesigner={data.isDesigner} />
      );

    case "divider":
      return <Separator className="w-full" />;

    case "spacer":
      /*
       * A gap is nothing, which on a canvas you arrange by hand is a block you
       * cannot see, cannot aim at and cannot tell from the card behind it. The
       * hatch is designer-only and faint — enough to say "this space is a
       * thing", not enough to be mistaken for a design element. A real card
       * still gets the empty box, because there it *is* nothing.
       */
      return (
        <div
          className={`h-full w-full${data.isDesigner ? " card-spacer-hint" : ""}`}
        />
      );

    default:
      return null;
  }
}

/**
 * The gallery, as one picture.
 *
 * A plain `img` rather than `next/image`, for the same reason the edit form's
 * thumbnails are: behind auth, small, and not worth a per-request transform. The
 * name is the caption right below it, so repeating it as alt text would make a
 * screen reader read the place twice.
 *
 * `draggable={false}` because a plain `img` is natively draggable by the
 * browser, and a press on the photo would otherwise race the block's own
 * pointer-drag (`useRowDragSource`) against the browser's built-in "drag this
 * image out" gesture — which is why the gallery block used to be unreliable to
 * pick up.
 *
 * `--card-fit` is the block's own Fill-or-Fit choice, written onto the block by
 * `blockStyle`. The fallback in the rule is what every card drew before the
 * control existed, so a block that has never been asked still crops.
 */
function Gallery({
  place,
  sampleImageUrl,
  onSampleImage,
}: {
  place: Place;
  sampleImageUrl?: string | null;
  onSampleImage?: (file: File) => void;
}) {
  const photo = place.photoUrls[0] ?? place.photoUrl ?? sampleImageUrl;

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        loading="lazy"
        draggable={false}
        className="h-full w-full [object-fit:var(--card-fit,cover)]"
      />
    );
  }

  // No photo to show. `onSampleImage` is only ever set by the designer, which
  // is what turns this into a real drop target rather than a dead end — a
  // real card has no file to drop, so it gets the plain half instead.
  return onSampleImage ? (
    <GallerySampleDropzone onSampleImage={onSampleImage} />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
      <ImageOff aria-hidden="true" className="size-5" />
      <span className="text-[11px]">No photo</span>
    </div>
  );
}

/**
 * Where a designer-only preview photo comes from: a native file drop, or a
 * click that opens the OS picker. Deliberately not the same drag this block
 * can itself be moved with — `NO_DRAG_PROPS` carves this whole surface out of
 * that gesture, the same way the remove button and the resize handle do, so
 * pressing here to choose a file cannot also pick the block up and move it. A
 * gallery block still has the corner grip for that.
 */
function GallerySampleDropzone({
  onSampleImage,
}: {
  onSampleImage: (file: File) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const inputId = useId();

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.type.startsWith("image/")) onSampleImage(file);
  };

  return (
    <label
      htmlFor={inputId}
      {...NO_DRAG_PROPS}
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        take(event.dataTransfer.files);
      }}
      className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed text-center text-muted transition-colors ${
        isOver ? "border-accent bg-accent-soft text-foreground" : "border-border"
      }`}
    >
      <ImagePlus aria-hidden="true" className="size-5" />
      <span className="px-2 text-[11px]">
        Drop an image to preview, or click to choose one
      </span>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => take(event.target.files)}
      />
    </label>
  );
}

/**
 * The fold, holding whatever was not pulled onto the card itself.
 *
 * A HeroUI `Disclosure` where the embed builds a bare `<details>`. Both open
 * from the keyboard and both say the same thing; this one is animated, carries
 * the app's own focus ring and turns its chevron the way every other expander in
 * the dashboard does, which is what a card sitting inside the dashboard should
 * do. The embed cannot have it — HeroUI is React (§4) — and does not need it.
 *
 * Uncontrolled: there is no state here worth lifting, and a fold that remembers
 * whether it was open across two different locations would be answering a
 * question about the last place, not this one.
 */
function Details({ data }: { data: CardBlockData }) {
  const inner = data.folded
    .map((type) => (
      <CardBlockContent key={type} type={type} data={data} />
    ))
    .filter((node) => node !== null);

  // Nothing inside means no fold at all, rather than a control that opens onto
  // an empty box — that's the real card's behaviour, and it stays exactly
  // this way for it.
  const hasContent = data.folded.some((type) => hasBlockContent(type, data));

  if (!hasContent) {
    // A real visitor's card still renders nothing here; the designer draws a
    // placeholder instead, so a block that would otherwise collapse to zero
    // height still reads as present, selectable and full width on the canvas
    // rather than as a rendering bug.
    if (!data.isDesigner) return null;

    return (
      <p className="border-t border-border pt-1.5 text-xs text-muted">
        Nothing to show yet for this sample location.
      </p>
    );
  }

  return (
    <Disclosure className="border-t border-border pt-1.5">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full cursor-pointer items-center gap-1 text-xs text-muted">
          More details
          <Disclosure.Indicator className="size-3.5" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="space-y-2 pt-1.5">{inner}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

/**
 * Whether a block would render anything for this location.
 *
 * Asked in two places, and both need it for the same reason: a `<details>` with
 * three empty children is still a control the visitor can open, and a block that
 * draws nothing is still a box with the owner's padding on it and a gap after it.
 *
 * The embed answers this structurally — `buildPopup` only appends a wrapper once
 * its builder has returned a node, so an empty block costs a visitor nothing at
 * all. React renders children after the fact, so the dashboard has to ask first
 * or the two cards disagree about how tall an under-filled location is. Which is
 * why this is exhaustive rather than a switch over the three blocks the fold
 * happens to hold.
 */
export function hasBlockContent(
  type: CardBlockType,
  data: CardBlockData,
): boolean {
  const { place, category, fields } = data;

  switch (type) {
    case "gallery":
      return Boolean(place.photoUrls[0] ?? place.photoUrl ?? data.sampleImageUrl);
    // Always. `resolvePin` answers a plain ball for a location that has never
    // been given an icon, which is still this location's mark — there is no
    // under-filled case for a logo to collapse on.
    case "logo":
      return true;
    case "name":
      return Boolean(place.name);
    case "category":
      return Boolean(category);
    case "address":
      return Boolean(place.address);
    case "description":
      return Boolean(place.description);
    case "hours":
      // The same test `PlaceCardHours` returns null on — a week of seven closed
      // days is a week nobody filled in.
      return !isEmptyHours(place.hours);
    case "fields":
      return fields.some(
        (field) => field.showAs === "row" && place.fields[field.id],
      );
    case "details":
      // The fold is only as real as what is left in it.
      return data.folded.some((folded) => hasBlockContent(folded, data));
    case "actions":
      return (
        Boolean(place.phone) ||
        Boolean(place.email) ||
        Boolean(safeHttpUrl(place.url)) ||
        fields.some((field) => field.showAs === "button" && place.fields[field.id])
      );
    // A rule and a gap are shapes, not content — they are exactly as present on
    // an empty location as on a full one.
    case "divider":
    case "spacer":
      return true;
    default:
      return true;
  }
}

/** The map's extra fields, in the order their owner defined them. */
function FieldRows({ place, fields }: { place: Place; fields: MapField[] }) {
  const rows = fields.filter(
    (field) => field.showAs === "row" && place.fields[field.id],
  );

  if (rows.length === 0) return null;

  return (
    <dl className="space-y-1">
      {rows.map((field) => (
        <div key={field.id} className="flex gap-2 text-xs">
          <dt className="shrink-0 text-muted">{field.label}</dt>
          <dd className="min-w-0 truncate text-foreground">
            {place.fields[field.id]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The ways to reach a location.
 *
 * Links, not text: a phone number on a card you are looking at while standing
 * outside the shop should be tappable. `tel:` and `mailto:` are safe by
 * construction; the website is customer input and gets its scheme checked.
 *
 * **One wrapping line of icon-and-label pairs, not a stack of filled buttons.**
 * They were full-width `buttonVariants` rows: three of them ate about a third of
 * a card that is capped at `min(8.75rem, …)` tall, and the grey fill made the
 * three least interesting facts on the card the loudest thing on it. What a
 * visitor needs from these is *reachability*, which an icon and the value give
 * in a fraction of the height — so they sit on one `flex-wrap` line, at the same
 * 11px the rest of the card's small print uses, with no fill at all. The tap
 * target is kept honest with vertical padding rather than a background: still
 * clear of the 24px a thumb needs, without drawing a box around it.
 *
 * `min-w-0` on the item plus `truncate` on the label is what stops one long
 * email from pushing the other two off the card — a wrapped flex item's default
 * `min-width: auto` refuses to shrink below its content.
 *
 * **Except on the designer canvas, where they are not links at all.** An anchor
 * is natively draggable, so a press on one races the browser's own "drag this
 * link out" gesture against `useRowDragSource`'s threshold — the block simply
 * would not pick up, which is the same collision the gallery image carries
 * `draggable={false}` for above. It is also still navigable, and a card you are
 * arranging should not be able to send you to a customer's website. So there
 * the rows render as what they look like and nothing more.
 */
function Actions({
  place,
  fields,
  isDesigner,
}: {
  place: Place;
  fields: MapField[];
  isDesigner?: boolean;
}) {
  const website = safeHttpUrl(place.url);
  const buttons = fields.filter(
    (field) => field.showAs === "button" && place.fields[field.id],
  );

  if (!place.phone && !place.email && !website && buttons.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {place.phone ? (
        <ContactRow
          icon={Phone}
          label={place.phone}
          href={`tel:${place.phone}`}
          isDesigner={isDesigner}
        />
      ) : null}

      {place.email ? (
        <ContactRow
          icon={Mail}
          label={place.email}
          href={`mailto:${place.email}`}
          isDesigner={isDesigner}
        />
      ) : null}

      {website ? (
        <ContactRow
          icon={Globe}
          label={website.host + website.pathname.replace(/\/$/, "")}
          href={website.href}
          isDesigner={isDesigner}
        />
      ) : null}

      {/* The owner's own calls to action, given the label they wrote rather than
          the value — which for a URL would be forty characters of tracking
          parameters. Same rule as the embed's card. */}
      {buttons.map((field) => {
        const href = safeHttpUrl(place.fields[field.id]);

        return href ? (
          <ContactRow
            key={field.id}
            icon={Globe}
            label={field.label}
            href={href.href}
            isDesigner={isDesigner}
          />
        ) : null;
      })}
    </ul>
  );
}

function ContactRow({
  icon: Icon,
  label,
  href,
  isDesigner,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  isDesigner?: boolean;
}) {
  const inner = (
    <>
      <Icon aria-hidden="true" className="size-3 shrink-0 text-muted" />
      <span className="truncate">{label}</span>
    </>
  );

  // No `fullWidth`, no fill, and the same 11px as the card's other small print
  // — see `Actions`. `py-0.5` keeps the target tall enough to hit on a phone
  // now that there is no button padding doing it.
  const className =
    "inline-flex min-w-0 max-w-full items-center gap-1 py-0.5 text-[11px] text-foreground transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <li className="min-w-0">
      {isDesigner ? (
        // The same row, drawn and not wired — see `Actions`. A span rather than
        // an anchor, so nothing here can be dragged out as a link or followed to
        // a customer's website from a card somebody is arranging.
        <span className={className}>{inner}</span>
      ) : (
        <a
          href={href}
          // A location's website is a third party's, and this card is inside our
          // dashboard — no reaching back through window.opener.
          rel="noopener noreferrer"
          target="_blank"
          // The browser will happily drag an anchor out of the page as a link,
          // which is a gesture nobody wants from a map popup and one that races
          // any pointer drag the card is inside of — the same reason the gallery
          // image sets this.
          draggable={false}
          className={className}
        >
          {inner}
        </a>
      )}
    </li>
  );
}

/**
 * `url` is stored after a validation that accepts any parseable URL, which
 * includes `javascript:`. Rendering it as a link would be handing a click to
 * whatever was typed, so anything that is not http(s) is dropped.
 */
function safeHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
