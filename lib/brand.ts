import { z } from "zod";

import raw from "@/brand.json";

/**
 * The product's public identity — name, logo, company, contact and legal links —
 * read from `brand.json` at the repo root. That file is the one place to change
 * any of them; this module is how the rest of the app reads it.
 *
 * **Everything in that file reaches the browser.** Client components import this
 * module (the sidebar, the account menu), so the bundler inlines the whole JSON
 * into client JavaScript. Public values only — a secret belongs in `.env`.
 *
 * **Validated at module load, so a bad value fails the build.** The file is
 * edited by hand, and a typo there — `"termsUrl": "terms"` — would otherwise
 * ship as a link that 404s on every page carrying it. Throwing here puts the
 * field's name in the dev overlay and in `next build`'s output instead.
 *
 * **An empty string means "not set"**, and whatever the value feeds is not
 * drawn: no Terms link to nowhere, no "Contact support" with no address behind
 * it. The committed file is mostly empty strings for exactly that reason — it
 * lists every key there is to fill in, and filling one in is what turns it on.
 *
 * **Strict objects**: an unknown key is an error rather than ignored, because an
 * ignored `"termUrl"` looks exactly like a link that was never set.
 */

/** Trimmed, with `""` read as absent. */
function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * A full http(s) address, or a path on our own origin — a file in `/public`, or
 * a page in `/app`. `//host` is excluded: it is a protocol-relative URL to
 * somebody else's server, not a path.
 */
function isLink(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const text = z.preprocess(blankToUndefined, z.string().optional());

const link = z.preprocess(
  blankToUndefined,
  z
    .string()
    .refine(
      isLink,
      "Use a full address starting with https://, or a path starting with / for a file in /public.",
    )
    .optional(),
);

const email = z.preprocess(
  blankToUndefined,
  z.email("Use a full email address, like support@example.com.").optional(),
);

const brandSchema = z.strictObject({
  name: z.string().trim().min(1, "Give the product a name."),
  tagline: z.string().trim().min(1, "Give the product a one-line tagline."),
  website: link,
  logo: z
    .strictObject({ light: link, dark: link, alt: text })
    .refine((logo) => !logo.dark || logo.light, {
      message: "Set logo.light too — logo.dark is only the variant for the dark theme.",
      path: ["light"],
    })
    .prefault({}),
  favicon: link,
  company: z
    .strictObject({
      legalName: text,
      registrationNumber: text,
      vatNumber: text,
      address: text,
    })
    .prefault({}),
  contact: z
    .strictObject({ supportEmail: email, privacyEmail: email })
    .prefault({}),
  legal: z
    .strictObject({
      termsUrl: link,
      privacyUrl: link,
      cookiesUrl: link,
      dpaUrl: link,
    })
    .prefault({}),
  social: z
    .strictObject({
      x: link,
      linkedin: link,
      facebook: link,
      instagram: link,
      github: link,
    })
    .prefault({}),
});

export type Brand = z.output<typeof brandSchema>;

/** Parse a brand document, throwing one error that names every bad field. */
export function parseBrand(input: unknown): Brand {
  const result = brandSchema.safeParse(input);
  if (result.success) return result.data;

  const problems = result.error.issues.map(
    (issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  throw new Error(`brand.json is not valid:\n${problems.join("\n")}`);
}

export const BRAND: Brand = parseBrand(raw);

/**
 * Whether a brand link leaves our origin — and so opens in a new tab rather
 * than going through the router.
 */
export function isExternalLink(href: string): boolean {
  return !href.startsWith("/");
}
