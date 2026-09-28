import { z } from "zod";

/**
 * A message to support from the account menu — a bug report or a support
 * request. One schema, run by the form and again by the route (CLAUDE.md §9).
 *
 * The option lists live here, beside the enums they label, because two places
 * read them: the form's buttons and the email's subject line. A label that
 * drifted between them would sort a report under a topic nobody picked.
 *
 * `page` and `viewport` are filled in by the form, not typed: where the person
 * was and how big their screen is are the two things a report most often leaves
 * out and the two a reply most often has to ask for.
 */

export const BUG_AREAS = [
  { id: "editor", label: "Map & editor" },
  { id: "import", label: "Import" },
  { id: "published", label: "Published map" },
  { id: "account", label: "Account & billing" },
] as const;

export const SUPPORT_TOPICS = [
  { id: "billing", label: "Billing" },
  { id: "account", label: "Account" },
  { id: "maps", label: "Maps" },
  { id: "other", label: "Other" },
] as const;

export type SupportKind = "bug" | "support";
export type BugArea = (typeof BUG_AREAS)[number]["id"];
export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["id"];

const ids = <T extends readonly { id: string }[]>(options: T) =>
  options.map((option) => option.id) as [T[number]["id"], ...T[number]["id"][]];

const shared = {
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters.")
    .max(4000, "Keep it under 4,000 characters."),
  replyTo: z
    .string()
    .trim()
    .pipe(z.email("Use a full email address, like you@example.com.")),
  page: z.string().trim().max(500).optional(),
  viewport: z.string().trim().max(20).optional(),
};

export const supportRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bug"), area: z.enum(ids(BUG_AREAS)), ...shared }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(ids(SUPPORT_TOPICS)),
    ...shared,
  }),
]);

export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
export type SupportRequestFormValues = z.input<typeof supportRequestSchema>;

/** The label of whichever option the request carries — area for a bug, topic otherwise. */
export function subjectLabel(input: SupportRequestInput): string {
  return input.kind === "bug"
    ? BUG_AREAS.find((area) => area.id === input.area)!.label
    : SUPPORT_TOPICS.find((topic) => topic.id === input.topic)!.label;
}
