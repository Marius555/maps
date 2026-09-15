import type { Place } from "@/lib/repositories/types";

/**
 * A location the card designer draws when the map has none of its own.
 *
 * **This overrides a decision recorded on the page above it**, and the old
 * argument is worth keeping rather than deleting, because it is right about
 * something. `app/(dashboard)/maps/[id]/card/page.tsx` used to say the card is
 * drawn from a real location so that "an invented sample would show a card that
 * looks finished against data nobody has, and the first thing an owner needs to
 * know is what their card does when a location has no photo." That holds for
 * every map that *has* locations, and nothing here changes those: the real one
 * still wins, and `CardDesigner` only reaches for this when `places` is empty.
 *
 * What it got wrong is the empty case. A map with no locations showed no card at
 * all — a sentence telling the owner to go and do something else first — on the
 * one screen whose entire job is showing what a card looks like. The order
 * people actually work in is to look at the thing before filling it, and the
 * published card for that same account is already the full default layout, so
 * the designer was the only place claiming there was nothing to see.
 *
 * **Designer-only, session-only, never saved, never published.** That is the
 * established shape for stand-in data on this screen — `sampleImageUrl` in
 * `card-designer.tsx` and `previewChips` in ./preview-chips.ts have exactly the
 * same guarantees — and it is why this is a frozen constant rather than a row
 * anything creates. Nothing writes it, nothing fetches it, and it never reaches
 * `buildSnapshot`.
 *
 * **In /lib and not /packages/shared**, which is not a filing preference: the
 * embed inherits whatever that directory holds, and it is 0.2KB from its
 * ceiling (CLAUDE.md §4). `block-labels.ts` is kept out of it for the same
 * reason — English the dashboard needs and the embed must never ship.
 *
 * The content is chosen so every block on `defaultCardLayout()` draws something
 * rather than its empty reservation: a name, a street address with a town and a
 * postcode, a description long enough to show the clamp, a week with one closed
 * day, and all four link targets. Two things are deliberately left out:
 *
 * - **`tags` is empty**, and the chips come from `previewChips` instead. A
 *   fresh map has no tag vocabulary, so an invented tag id would resolve to
 *   nothing here and — worse — a synthetic chip pushed to the front would paint
 *   the sample pin a colour the map has never heard of. ./preview-chips.ts
 *   already solves precisely this and says so at length.
 * - **`photoUrl` is null**, so the gallery block draws its own dropzone
 *   (`GallerySampleDropzone`). That is the designed answer for "no photo yet",
 *   and it keeps the half of the old argument that was correct: an owner sees
 *   what an incomplete location does, and can drop a picture in to see the
 *   other case.
 */
/**
 * How many chips the sample is drawn with, when it is the sample being drawn.
 *
 * Three: enough that the Tags block is visibly a row of chips rather than one
 * pill that could be mistaken for a label, and few enough not to wrap at the
 * card's default 320px and make the example look like a tag problem.
 *
 * It lives here rather than in `CardDesigner` because it is a fact about the
 * stand-in, and `previewChips` is what turns it into chips — see the note on
 * `tags` below.
 */
export const SAMPLE_CHIP_COUNT = 3;

export const SAMPLE_PLACE: Place = Object.freeze({
  /*
   * Not an id anything could mistake for a row, and not one derived from a
   * label either — CLAUDE.md's rule about minting ids is about resurrection,
   * and the way to keep this out of that story is for it to name nothing. The
   * prefix is what a reader sees in a React key or a devtools inspection.
   */
  id: "sample:card-designer",
  mapId: "",
  name: "Willow & Vine",
  /*
   * Somewhere real, so a Directions link opens a map rather than the Atlantic:
   * this is the middle of Utrecht. The card never draws coordinates, but
   * `buttonTargetOf` builds a maps URL out of them and a designer who presses
   * it should not land at 0°,0°.
   */
  lat: 52.0907,
  lng: 5.1214,
  address: "Oudegracht 187, 3511 NE Utrecht",
  tags: [],
  fields: {},
  icon: "",
  description:
    "A corner shop and roastery on the canal, open since 2016. Beans are roasted in the back on Tuesdays, and the window seats look straight down the water.",
  phone: "+31 30 123 4567",
  email: "hello@willowandvine.example",
  url: "https://willowandvine.example",
  /*
   * Index 0 is Monday. A normal week with one closed day and a short Sunday,
   * because a card whose every row reads "09:00–17:00" says nothing about what
   * the block does with a closed day or with a row that is not like its
   * neighbours — which is the whole reason to look at it.
   */
  hours: [
    { open: "08:00", close: "18:00" },
    { open: "08:00", close: "18:00" },
    { open: "08:00", close: "18:00" },
    { open: "08:00", close: "21:00" },
    { open: "08:00", close: "21:00" },
    { open: "09:00", close: "17:00" },
    null,
  ],
  photoIds: [],
  photoUrls: [],
  photoUrl: null,
  logoId: null,
  logoUrl: null,
  sortOrder: 0,
  geocodeConfidence: null,
  geocodeStatus: "manual",
  addressParts: null,
  groupId: "",
  cardBlocks: {},
  createdAt: "",
  updatedAt: "",
});
