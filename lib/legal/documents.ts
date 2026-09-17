/**
 * The four legal documents, and where each one is published.
 *
 * The text lives in `documents/legal/*.md` — one source, which a lawyer edits as
 * Markdown and the pages render as it stands. `path` is the page in
 * `app/(marketing)` that serves it; `brandKey` is the `brand.json` link that,
 * once set to that path, turns on every link to it across the app.
 */

export type LegalSlug = "terms" | "privacy" | "cookies" | "dpa";

export type LegalDocument = {
  slug: LegalSlug;
  path: `/${LegalSlug}`;
  /** File name inside `documents/legal/`. */
  file: string;
  title: string;
  summary: string;
  brandKey: "termsUrl" | "privacyUrl" | "cookiesUrl" | "dpaUrl";
};

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: "terms",
    path: "/terms",
    file: "terms-of-service.md",
    title: "Terms of Service",
    summary: "The contract between us and the businesses that use the service.",
    brandKey: "termsUrl",
  },
  privacy: {
    slug: "privacy",
    path: "/privacy",
    file: "privacy-policy.md",
    title: "Privacy Policy",
    summary: "What personal data we process, why, and the rights you have over it.",
    brandKey: "privacyUrl",
  },
  cookies: {
    slug: "cookies",
    path: "/cookies",
    file: "cookie-policy.md",
    title: "Cookie Policy",
    summary: "The cookies and browser storage the service uses, and why.",
    brandKey: "cookiesUrl",
  },
  dpa: {
    slug: "dpa",
    path: "/dpa",
    file: "data-processing-agreement.md",
    title: "Data Processing Agreement",
    summary: "The terms under which we process personal data on our customers' behalf.",
    brandKey: "dpaUrl",
  },
};
