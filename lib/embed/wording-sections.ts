import type { EmbedStringKey } from "@/packages/shared/embed-strings";

/**
 * Every phrase the published map says, grouped by where a visitor meets it and
 * named for that place — the owner is looking at their map, not at our keys.
 *
 * Every key in `EMBED_STRINGS` appears exactly once — `wording-sections.test.ts`
 * holds that, because a phrase missing here is one the owner can never reword.
 */
export const WORDING_SECTIONS: {
  title: string;
  fields: { key: EmbedStringKey; label: string; description?: string }[];
}[] = [
  {
    title: "Search",
    fields: [
      { key: "searchPlaceholder", label: "Search box hint" },
      {
        key: "searchLabel",
        label: "Search box name",
        description: "Read out by screen readers.",
      },
    ],
  },
  {
    title: "Nearest to me",
    fields: [
      { key: "nearest", label: "Button" },
      { key: "nearestStop", label: "Button while measuring" },
      {
        key: "nearestFound",
        label: "Nearest location found",
        description: "Keep {place} and {distance} — they are filled in.",
      },
      { key: "locating", label: "While locating" },
      { key: "locationOff", label: "Location turned off" },
      { key: "locationTimeout", label: "Location timed out" },
      { key: "locationUnsupported", label: "Browser can't share location" },
      { key: "locationFailed", label: "Location failed" },
    ],
  },
  {
    title: "Results",
    fields: [
      { key: "locations", label: "Results list name" },
      { key: "noMatch", label: "Nothing matches" },
    ],
  },
  {
    title: "Location card",
    fields: [
      { key: "directions", label: "Directions" },
      { key: "email", label: "Email" },
      { key: "website", label: "Website button" },
      { key: "moreDetails", label: "More details" },
      { key: "openNow", label: "Open now" },
      { key: "closedNow", label: "Closed now" },
      { key: "closed", label: "Closed all day" },
      { key: "previousPhoto", label: "Previous photo" },
      { key: "nextPhoto", label: "Next photo" },
    ],
  },
  {
    title: "Other",
    fields: [{ key: "dismiss", label: "Close a message" }],
  },
];
