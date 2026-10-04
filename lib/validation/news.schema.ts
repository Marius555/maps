import { z } from "zod";

import { NEWS_CATEGORIES } from "@/lib/news/types";

/**
 * A news post, as the operator console writes it. docs/notes/news.md.
 *
 * Two schemas, the way notifications has them: `adminNewsFormSchema` is what the
 * editor speaks (a status and a date the form may leave empty) and is also the
 * request body; `newsInputSchema` is what the repository is written against,
 * where the publish time is decided — an ISO time or null for a draft.
 */

export const NEWS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const NEWS_SLUG_MAX = 120;

/** A post's address from its title: the same rule the slug field enforces. */
export function newsSlugFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, NEWS_SLUG_MAX)
    .replace(/-+$/, "");
}

const title = z.string().trim().min(1, "Add a title.").max(160, "Keep the title under 160 characters.");
const slug = z
  .string()
  .trim()
  .min(1, "Add the post's address.")
  .max(NEWS_SLUG_MAX, `Keep the address under ${String(NEWS_SLUG_MAX)} characters.`)
  .regex(NEWS_SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens.");
const summary = z
  .string()
  .trim()
  .min(1, "Add a one-line summary.")
  .max(300, "Keep the summary under 300 characters.");
const body = z
  .string()
  .trim()
  .min(1, "Write the post.")
  .max(50_000, "Keep the post under 50,000 characters.");
const category = z.enum(NEWS_CATEGORIES, "Choose a category.");
const coverAlt = z.string().trim().max(200, "Keep the description under 200 characters.");

export const newsInputSchema = z.object({
  title,
  slug,
  summary,
  body,
  category,
  coverAlt,
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type NewsInput = z.output<typeof newsInputSchema>;

export const NEWS_STATUSES = ["draft", "published"] as const;

export const adminNewsFormSchema = z.object({
  title,
  slug,
  summary,
  body,
  category,
  coverAlt,
  status: z.enum(NEWS_STATUSES),
  // Either a wall-clock date-time (the form's DatePicker) or ISO (the request
  // body): the editor converts on submit. Empty means "now".
  publishedAt: z
    .string()
    .trim()
    .max(40)
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Enter a date and time."),
});

export type AdminNewsForm = z.infer<typeof adminNewsFormSchema>;

/**
 * The form's values as `newsInputSchema` expects them. A draft has no publish
 * time; a published post without one is published `now`.
 */
export function toNewsInput(form: AdminNewsForm, now: Date = new Date()): z.input<typeof newsInputSchema> {
  return {
    title: form.title,
    slug: form.slug,
    summary: form.summary,
    body: form.body,
    category: form.category,
    coverAlt: form.coverAlt,
    publishedAt:
      form.status === "draft"
        ? null
        : new Date(form.publishedAt ? Date.parse(form.publishedAt) : now.getTime()).toISOString(),
  };
}
