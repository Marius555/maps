"use client";

import { Chip, Disclosure, Separator } from "@heroui/react";
import {
  ChevronDown,
  Globe,
  ImageOff,
  ImagePlus,
  Mail,
  Navigation,
  Phone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";


import { NO_DRAG_PROPS } from "@/components/groups/use-row-drag";
import { PinPreview } from "@/components/map/pin-preview";
import { PlaceCardHours } from "@/components/map/place-card/place-card-hours";
import { isEmptyHours } from "@/packages/shared/hours";
import type { MapField, Place } from "@/lib/repositories/types";
import { resolvePin, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { pinColorOfChips, type TagChip } from "@/packages/shared/tags";
import {
  buttonStyleOf,
  chipStyleOf,
  justifyOf,
  logoImageOf,
  type CardBlock,
  type CardBlockType,
  type CardButtonStyle,
} from "@/packages/shared/card-layout";
import { buttonTargetOf } from "@/packages/shared/card-button";
import { directionsUrl } from "@/packages/shared/directions";

/**
 * One block of a location card, in React.
 *
 * The twin of the `BUILDERS` table in embed/src/popup.ts, and the two are held
 * together by the layout they both read rather than by this file resembling that
 * one — the embed builds DOM nodes by hand because it must not ship React, and
 * this uses the dashboard's own components because it should. What has to match
 * is *what a block is*, not how it is made.
 *
 * That licence is spent here, deliberately and in three places: a tag is a
 * HeroUI `Chip`, the fold is a HeroUI `Disclosure` where the embed keeps a
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
  /**
   * The tags this location wears, resolved and **in the location's own order**.
   *
   * Resolved rather than ids plus the map's vocabulary, so this and the embed's
   * `BUILDERS.tags` take the same input and cannot disagree about which tags a
   * pin has — one lookup per map, done where the map is, not once per card in
   * two renderers (`tagChipsOf` in packages/shared/tags.ts does it). Ids the map
   * no longer defines are dropped on the way in: nothing sweeps a deleted tag
   * off the places wearing it, so a dangling id is the normal state
   * (lib/validation/tag.schema.ts).
   *
   * The order is load-bearing rather than cosmetic. Since categories merged into
   * tags, the first of these is what colours the pin the visitor just clicked —
   * which is what the retired Category block draws, and what the Logo block
   * falls back to when a location has no pin of its own.
   */
  tagChips: readonly TagChip[];
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

/**
 * The whole block, not just its type.
 *
 * Three of these read a field of their own — the week reads whether it starts
 * open and how its days are named, and the description reads whether it is
 * clipped, which is also what decides whether it folds — and a type alone
 * cannot answer any of it.
 * The fold passes a bare `{ id, type }` for a block that is not on the card
 * (see `Details`), which is the same nothing the embed's `buildMore` passes.
 */
export function CardBlockContent({
  block,
  data,
}: {
  block: CardBlock;
  data: CardBlockData;
}) {
  const { place, tagChips } = data;

  /** What the pin outside this card is wearing — see `CardBlockData.tagChips`. */
  const pinColor = pinColorOfChips(tagChips);

  switch (block.type) {
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
       * The location's own pin, drawn at the size its block was given — or the
       * logo inside it, on its own, when the owner asked for that.
       *
       * `PinPreview` and not a new drawing: the pin a customer designed, the
       * marker on the map, the tile they pressed to design it and this are one
       * `pinSvg` rendered in four places. A pin carrying an uploaded image is a
       * logo; one carrying a glyph is the mark that map uses for this kind of
       * place. Both are the right answer to "what is this location's badge",
       * which is why there is no empty state here.
       *
       * `logoImageOf` is the one place the choice is made — the embed's own
       * `buildLogo` asks the same function — and it is what makes the bare-logo
       * mode safe on a map of four hundred locations: asking for the image is
       * asking for it *if this pin has one*, and the pin is what the rest get.
       *
       * No `color` prop — that override belongs to a group, and a card is not
       * looking at one. The first tag is the fallback, exactly as it is on the
       * map: the pin's own colour first, its first tag's if it has none.
       */
      return <Logo block={block} data={data} fallbackColor={pinColor} />;

    case "name":
      return (
        <h3 className="card-text card-text--name line-clamp-2">{place.name}</h3>
      );

    case "category":
      /*
       * The location's **first** tag, alone.
       *
       * This block is the retired Category one. It is kept because a layout
       * saved while categories existed still parses and still names it, and a
       * block that renders nothing would silently drop a row out of somebody's
       * design. What it draws is the nearest true thing: since the merge, the
       * first tag is what a category was — the one that colours the pin.
       *
       * Nothing puts it in a new layout (`defaultCardLayout` and the designer's
       * palette both offer Tags instead), so on every card designed from here on
       * this case never runs.
       */
      if (tagChips.length > 0) {
        return <TagChips block={block} chips={tagChips.slice(0, 1)} />;
      }

      if (!data.isDesigner) return null;

      return <EmptyTagChip block={block} />;

    case "tags":
      /*
       * A wrapping row of chips, and the only text block whose height varies
       * with the location rather than with its words.
       *
       * **No chip carries a colour dot.** The first one used to, as the card
       * answering "which of these is the pin I just clicked?" — but on a card it
       * read as a bubble of a colour nobody had chosen, sitting inside a pill
       * whose whole colour scheme is now the owner's to set. The pin is on
       * screen beside the card it opened from, which is the answer that needed
       * no legend. `pinColor` is still worked out above, because the Logo block
       * falls back to it.
       *
       * A sample location with no tags still draws a chip in the designer, for
       * the reason `Details` draws its placeholder: a block that returns null on
       * the canvas has no height, no words and nothing to aim at, so someone
       * drops Tags, sees a two-pixel gap and concludes the block is broken. A
       * real card renders nothing at all, because there an untagged location is
       * a fact about the location rather than about the sample.
       */
      if (tagChips.length > 0) {
        return <TagChips block={block} chips={tagChips} />;
      }

      if (!data.isDesigner) return null;

      return <EmptyTagChip block={block} />;

    case "address":
      return place.address ? (
        // Two lines, then an ellipsis. A full address is what this line is for,
        // and truncating after one hid the half that says which town.
        <p className="card-text card-text--body line-clamp-2">{place.address}</p>
      ) : null;

    case "description":
      if (!place.description) return null;

      /* Clipped means folded — see `clampLines`. A paragraph nobody has clipped
         is the plain `<p>` it has always been, which is every card published so
         far. */
      return block.clampLines ? (
        <Description text={place.description} />
      ) : (
        <p className="card-text card-text--strong whitespace-pre-line">
          {place.description}
        </p>
      );

    case "hours":
      return (
        <PlaceCardHours
          hours={place.hours}
          isOpen={block.hoursOpen}
          longDays={block.hoursLongDays}
        />
      );

    case "details":
      return <Details data={data} />;

    case "actions":
      return (
        <Actions
          block={block}
          place={place}
          fields={data.fields}
          isDesigner={data.isDesigner}
        />
      );

    case "button":
      return (
        <CardButton
          block={block}
          place={place}
          fields={data.fields}
          isDesigner={data.isDesigner}
        />
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
 * A clipped description, and the chevron that opens the rest of it.
 *
 * Clipping without this is a paragraph with its last sentence deleted: the
 * owner asked for a short card, not for half a sentence to be unreachable. So
 * `clampLines` carries both halves — the summary is the clipped lines, and the
 * control beside them is the week's own chevron, one press away from the whole
 * thing.
 *
 * **One paragraph node, in both states.** The clamp is a class the button turns
 * on and off, not a second copy of the text under a fold — a screen reader
 * should not be read a location's description twice.
 *
 * A plain `<button>` rather than a HeroUI `Disclosure`, which is what the week
 * and the "More details" fold use. Those have a summary *and* a body, which is
 * what a `Disclosure` is; this has one element that changes shape, and there is
 * no body to put in `Disclosure.Content`. `aria-expanded` on the button says the
 * same thing the disclosure would, and the embed says it with `<details>`.
 *
 * Uncontrolled, like both of them, and for the same reason: which state it is in
 * is a fact about this reading, not about the design. Nothing here is ever
 * written to the layout.
 */
function Description({ text }: { text: string }) {
  const [isOpen, setOpen] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => {
        setOpen(!isOpen);
      }}
      // `items-start` so the chevron sits on the paragraph's *first* line and
      // stays there. It was `items-end`, on the argument that the last line is
      // where the reader runs out — but the last line is the one that moves:
      // opening the fold grows the paragraph, and the control walked down the
      // card away from the pointer that had just pressed it. A control has to be
      // in the same place after it is used as it was before.
      className="flex w-full cursor-pointer items-start gap-1 text-left"
    >
      {/*
        A span rather than the `<p>` this is when it is not folded: a `<p>` is
        flow content and a `<button>` may only hold phrasing content, so the
        paragraph would be pulled out of the button by the parser and the
        control would end up empty. The class list is otherwise the same, and
        `--card-lines` still comes from `blockStyle` on the block's own box.
      */}
      <span
        className={`card-text card-text--strong min-w-0 flex-1 whitespace-pre-line${
          isOpen ? "" : " card-clamp"
        }`}
      >
        {text}
      </span>
      <ChevronDown
        aria-hidden="true"
        className={`size-3.5 shrink-0 transition-transform${
          isOpen ? " rotate-180" : ""
        }`}
      />
    </button>
  );
}

/**
 * The location's badge: its pin, or the logo inside its pin.
 *
 * The twin of `buildLogo` in embed/src/popup.ts, and the pair is held together
 * by `logoImageOf` rather than by the two functions resembling each other — the
 * embed builds DOM by hand because it must not ship React (§4). What has to
 * match is *which of the two drawings this block is*.
 *
 * The bare logo is a plain `img` and not `next/image`, for `Gallery`'s reason
 * one step further: this is a `data:` URI already inlined in the map row, so
 * there is nothing for a per-request transform to fetch. `draggable={false}` for
 * `Gallery`'s reason exactly — a native image drag would race the designer's own
 * pointer-drag for the block.
 *
 * `object-contain` and not `cover`: a Logo block is drawn square (`isSelfSized`
 * in packages/shared/card-layout.ts), and a wordmark cropped to a square is a
 * wordmark with its end cut off. Letterboxing inside the size its owner dragged
 * is the predictable answer, and it leaves `blockBox`'s squaring alone.
 */
function Logo({
  block,
  data,
  fallbackColor,
}: {
  block: CardBlock;
  data: CardBlockData;
  fallbackColor: string | undefined;
}) {
  const pin = resolvePin(data.place.icon, data.pinIcons);
  const image = logoImageOf(block, pin?.image ?? "");

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    );
  }

  return (
    <PinPreview
      icon={data.place.icon}
      pinIcons={data.pinIcons}
      fallbackColor={fallbackColor}
      size="fill"
    />
  );
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
      /*
       * A bare block, because a folded type is by definition *not* on the card
       * and so has no stored options of its own — a week in here starts
       * collapsed with short day names, which is what the embed's own fold
       * builds and what this drew before any of those options existed.
       */
      <CardBlockContent key={type} block={{ id: type, type }} data={data} />
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
 * A row of tags.
 *
 * `card-text` sits on the label rather than on the chip: every one of its
 * fallbacks is `inherit`, so an unstyled chip resolves to exactly the size,
 * weight and colour the chip itself sets — and a styled one moves its words
 * without touching the ground they sit on.
 *
 * **The block's own chip styling arrives inline**, from `chipStyleOf` — which is
 * shared with the embed, so the studio and a customer's site cannot come to
 * different conclusions about a pill. The ground is written as `--chip-bg` and
 * not as a `background-color`: `.chip` paints itself *through* that variable
 * (`@heroui/styles/dist/components/chip.css`), so setting it leaves HeroUI's own
 * variant rules to resolve the foreground, and an inline custom property beats
 * every selector that could have an opinion. Padding is added to what a chip
 * already has, so zero is the pill this always drew.
 *
 * `justifyContent` is what makes the block's Alignment control work at all: it
 * reaches a block as `text-align`, which cannot move a flex item — so the three
 * buttons moved nothing until this row started reading the same answer.
 */
function TagChips({
  block,
  chips,
}: {
  block: CardBlock;
  chips: readonly TagChip[];
}) {
  const chip = chipStyleOf(block);

  return (
    <div
      className="flex flex-wrap gap-1"
      style={chip?.justify ? { justifyContent: chip.justify } : undefined}
    >
      {chips.map((tag) => (
        <Chip
          key={tag.id}
          size="sm"
          variant="soft"
          className="card-chip max-w-full"
          style={chipBox(chip)}
        >
          <Chip.Label className="card-text truncate">{tag.label}</Chip.Label>
        </Chip>
      ))}
    </div>
  );
}

/**
 * The block at the size it will really be, saying why it is empty.
 *
 * Designer-only, and it wears the owner's own chip styling for the reason it
 * exists at all: it is a preview of the block, and a placeholder that ignored
 * the colour and the padding just set would make both controls look broken on
 * the one card where there is nothing else to try them on.
 */
function EmptyTagChip({ block }: { block: CardBlock }) {
  const chip = chipStyleOf(block);

  return (
    <div
      className="flex flex-wrap gap-1"
      style={chip?.justify ? { justifyContent: chip.justify } : undefined}
    >
      <Chip
        size="sm"
        variant="soft"
        className="card-chip max-w-full"
        style={chipBox(chip)}
      >
        <Chip.Label className="card-text truncate text-muted">
          No tags yet
        </Chip.Label>
      </Chip>
    </div>
  );
}

/**
 * One chip's own box, as custom properties. Absent fields are simply not
 * written, so an unstyled chip is the chip HeroUI draws.
 *
 * All four are properties rather than declarations, for the reason the type
 * styles above are: `--chip-bg` is what `.chip` already paints itself through,
 * so setting it leaves HeroUI's variant rules to resolve the foreground;
 * `--card-chip-pad` is *added* to the chip's own padding by `.card-chip` in
 * app/globals.css, so nought is the pill this always drew; and the outline's
 * two default to a transparent hairline of no width in that same rule, which is
 * the chip every published card is wearing.
 */
function chipBox(chip: ReturnType<typeof chipStyleOf>): CSSProperties {
  return {
    ...(chip?.background ? { "--chip-bg": chip.background } : {}),
    ...(chip?.padding ? { "--card-chip-pad": chip.padding } : {}),
    ...(chip?.border ? { "--card-chip-border": chip.border } : {}),
    ...(chip?.borderWidth
      ? { "--card-chip-border-width": chip.borderWidth }
      : {}),
  } as CSSProperties;
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
  /**
   * The block itself, for the two types whose emptiness depends on how they
   * were configured rather than only on the location. Optional because the
   * fold asks about a type with no block behind it — see `Details`.
   */
  block?: CardBlock,
): boolean {
  const { place, fields } = data;

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
    // The retired Category block, drawing this location's first tag — see the
    // case of the same name above. Same content, so the same test.
    case "category":
    case "tags":
      return data.tagChips.length > 0;
    case "address":
      return Boolean(place.address);
    case "description":
      return Boolean(place.description);
    case "hours":
      // The same test `PlaceCardHours` returns null on — a week of seven closed
      // days is a week nobody filled in.
      return !isEmptyHours(place.hours);
    case "details":
      // The fold is only as real as what is left in it.
      return data.folded.some((folded) => hasBlockContent(folded, data));
    /*
     * The row is as real as what it is allowed to draw, which is why the block
     * is read here and not just the location: a Links row with all four ticked
     * off is an empty box wearing its own padding and a gap after it, on every
     * card, forever.
     *
     * `block` is optional on this function because the fold builds a type with
     * no block behind it (see `Details`), and a folded Links row is one nobody
     * has configured — so absent reads as all four shown, which is the absence
     * everywhere else too.
     */
    case "actions":
      return (
        (!block?.hidePhone && Boolean(place.phone)) ||
        (!block?.hideEmail && Boolean(place.email)) ||
        (!block?.hideWebsite && Boolean(safeHttpUrl(place.url))) ||
        !block?.hideDirections ||
        fields.some((field) => field.showAs === "button" && place.fields[field.id])
      );
    // A button is as real as somewhere to go. Directions always resolves, so
    // this is only ever false for a link with nothing behind it — which is the
    // case the whole `null` return exists for.
    case "button":
      return block ? buttonTargetOf(block, place, fields) !== null : true;
    // A rule and a gap are shapes, not content — they are exactly as present on
    // an empty location as on a full one.
    case "divider":
    case "spacer":
      return true;
    default:
      return true;
  }
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
  block,
  place,
  fields,
  isDesigner,
}: {
  /**
   * Optional, because the fold builds this type with no block behind it (see
   * `Details`) — and a Links row nobody has configured shows all four, which is
   * what an absent `hide*` means everywhere else too.
   */
  block?: CardBlock;
  place: Place;
  fields: MapField[];
  isDesigner?: boolean;
}) {
  const phone = !block?.hidePhone ? place.phone : "";
  const email = !block?.hideEmail ? place.email : "";
  const website = !block?.hideWebsite ? safeHttpUrl(place.url) : null;
  const directions = !block?.hideDirections;
  const buttons = fields.filter(
    (field) => field.showAs === "button" && place.fields[field.id],
  );

  if (!phone && !email && !website && !directions && buttons.length === 0) {
    return null;
  }

  return (
    /*
     * `justify-content`, and it is the whole of the Alignment control working on
     * this block: `align` arrives as `text-align` (see `blockBox`), which cannot
     * move a flex item, so the three buttons moved nothing at all until this
     * line existed. `justifyOf` is the same mapping the chips row reads, which
     * is why it lives in packages/shared rather than here — the embed's own
     * `buildActions` asks it too, and two copies would be two different rows on
     * one screen in the preview panel.
     */
    <ul
      className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
      style={{ justifyContent: justifyOf(block?.align) }}
    >
      {phone ? (
        <ContactRow
          icon={Phone}
          label={phone}
          href={`tel:${phone}`}
          isDesigner={isDesigner}
        />
      ) : null}

      {email ? (
        <ContactRow
          icon={Mail}
          label={email}
          href={`mailto:${email}`}
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

      {/*
       * After the ways to *reach* the place and before the owner's own calls to
       * action, which is where the embed has always drawn it. It was drawn
       * *only* there: the dashboard's copy of this row never had a Directions
       * link at all, so the studio and the customer's site showed two different
       * rows, and `BLOCK_LABELS` described a block neither of them quite was.
       * The checkbox above is what makes moving it onto a Button possible.
       */}
      {directions ? (
        <ContactRow
          icon={Navigation}
          label="Directions"
          href={directionsUrl(place)}
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

/**
 * One press, drawn as a button.
 *
 * The twin of `buildButton` in embed/src/popup.ts, and — as with every block —
 * what has to match is *what a button is*, not how the DOM is made. Both read
 * `buttonTargetOf` for where it goes and `buttonStyleOf` for how it looks, so
 * the studio cannot promise a button the customer's site does not draw.
 *
 * **`card-text`, not a Tailwind size utility.** Every one of `.card-text`'s
 * values is a `var(--card-*, fallback)`, and a hardcoded `text-sm` on the leaf
 * would beat them — which is exactly how the Links row's Font, Size, Colour and
 * Bold controls came to do nothing at all for a while (see `ContactRow`). The
 * box's own four values arrive the same way, as `--card-button-*` custom
 * properties, so a button nobody has styled is drawn entirely by the stylesheet
 * and stays theme-aware.
 *
 * `inline-flex`, which is what makes the block's Alignment control work on it:
 * `align` reaches a block as `text-align`, and `text-align` moves an
 * inline-level box. A chip row needs `justify-content` instead precisely
 * because it is a flex container — see `chipStyleOf`.
 *
 * **A `<span>` on the designer canvas**, for `ContactRow`'s two reasons: an
 * anchor is natively draggable and races the block's own drag threshold, and a
 * card you are arranging should not be able to send you to a customer's site.
 */
function CardButton({
  block,
  place,
  fields,
  isDesigner,
}: {
  block: CardBlock;
  place: Place;
  fields: MapField[];
  isDesigner?: boolean;
}) {
  const target = buttonTargetOf(block, place, fields);

  /*
   * Nothing to point at is nothing to draw — the rule every block follows, and
   * the reason a Button set to a booking link is safe on a map where only some
   * locations have one.
   *
   * On the canvas it stands in instead: a block that collapses to zero height
   * cannot be selected, moved or given the link it is missing, which makes the
   * fix for an unconfigured button "delete it and start again".
   */
  if (!target) {
    if (!isDesigner) return null;

    return (
      <span className="card-button card-text card-button--empty">
        {block.buttonLabel ?? "No link yet"}
      </span>
    );
  }

  const style = buttonBox(buttonStyleOf(block));
  const className = `card-button card-text${buttonModifiers(block)}`;

  if (isDesigner) {
    return (
      <span className={className} style={style}>
        {target.label}
      </span>
    );
  }

  return (
    <a
      className={className}
      style={style}
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      {...NO_DRAG_PROPS}
    >
      {target.label}
    </a>
  );
}

/**
 * The button's treatment and hover as class names, appended to `.card-button`.
 *
 * Classes rather than custom properties, because neither is a *value*: an
 * outline is a ground, a border and a label colour moving together, and a hover
 * is a rule that only exists under the pointer. Both are read straight off the
 * block, the way `buttonFull` already is, rather than through `buttonStyleOf` —
 * that function's job is CSS values, and putting a class name in it would make
 * `CardButtonStyle` two kinds of thing.
 *
 * The embed's twin (`buildButton` in embed/src/popup.ts) says the same thing in
 * its own namespace and, unlike this, has to look each word up in a table: it
 * draws a published snapshot without ever re-parsing it, so the string it holds
 * is whatever wrote the file. Here the block has already been through
 * `readCardLayout`, which narrows both to their own vocabulary.
 */
function buttonModifiers(block: CardBlock): string {
  return [
    block.buttonFull ? " card-button--full" : "",
    block.buttonVariant ? ` card-button--${block.buttonVariant}` : "",
    block.buttonHover ? ` card-button--hover-${block.buttonHover}` : "",
  ].join("");
}

/**
 * A button's own four values as custom properties.
 *
 * `chipBox`'s twin, and written the same way for its reason: nothing is set for
 * a value nobody chose, so the stylesheet's own fallback stays in charge and a
 * card published before any of this existed draws exactly what it drew. A
 * stored `#ffffff` background would be a button that vanishes on a dark card;
 * an absent one is a button the theme colours.
 */
function buttonBox(style: CardButtonStyle | undefined): CSSProperties {
  if (!style) return {};

  return {
    ...(style.background ? { "--card-button-bg": style.background } : {}),
    ...(style.padding ? { "--card-button-pad": style.padding } : {}),
    ...(style.radius ? { "--card-button-radius": style.radius } : {}),
    ...(style.border ? { "--card-button-border": style.border } : {}),
    ...(style.borderWidth
      ? { "--card-button-border-width": style.borderWidth }
      : {}),
  } as CSSProperties;
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
      {/* `opacity-60` rather than `text-muted`: the glyph is a quieter shade of
          whatever colour the row is, so it follows a colour the owner picked
          instead of staying grey beside their brand blue. */}
      <Icon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
      <span className="truncate">{label}</span>
    </>
  );

  /*
   * No `fullWidth`, no fill, and the same 11px as the card's other small print
   * — see `Actions`. `py-0.5` keeps the target tall enough to hit on a phone
   * now that there is no button padding doing it.
   *
   * `card-text card-text--small` and **not** `text-[11px] text-foreground`,
   * which is what this was and is why the Links block was the one text block
   * whose Font, Size, Colour and Bold controls all visibly did nothing: the
   * block's own `--card-*` properties were written onto its box exactly as they
   * are for every other block, and a hard-coded utility on the row simply won
   * over them. The class was already written for this row — see the comment on
   * `.card-text--small` in app/globals.css — and its fallbacks are the same
   * 11px foreground, so an unstyled card is untouched.
   *
   * The hover is an underline rather than `hover:text-accent` for the same
   * cascade reason, in the other direction: `.card-text` is unlayered and beats
   * Tailwind's `@layer utilities`, so a hover colour there would never have
   * applied. An underline is also what the embed's own links do on hover.
   */
  const className =
    "card-text card-text--small inline-flex min-w-0 max-w-full items-center gap-1 py-0.5 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

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
