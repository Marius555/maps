import { BRAND } from "@/lib/brand";
import { LEGAL_DOCUMENTS, type LegalDocument } from "./documents";
import type { PlaceholderValues } from "./placeholders";

/**
 * Every value a legal document's `{{path}}` placeholders can be filled with.
 *
 * **Anything `brand.json` already holds is read from it**, never repeated here:
 * the company's name printed in the footer and the one in the contract must not
 * be able to disagree. What follows is only what `brand.json` has no field for.
 *
 * **An empty string means "not filled"**, and a document using it stays a draft
 * — `/terms` and the rest return 404 in production until nothing is left. What
 * each value means, and the order to fill them in, is in `documents/company.md`,
 * `documents/contact.md` and `documents/legal/README.md`.
 */
export const LEGAL_DETAILS = {
  company: {
    /**
     * In words. The service is run as an *individuali veikla* (VMI certificate
     * 1554078, from 2026-10-11); were it ever a company, this would read
     * "private limited liability company (UAB)".
     */
    legalForm:
      "natural person carrying out individual activity (individuali veikla)",
    /**
     * Who keeps the registration. For an individuali veikla it is VMI; for a
     * company it would be "Register of Legal Entities of the Republic of
     * Lithuania, kept by the State Enterprise Centre of Registers".
     */
    register:
      "State Tax Inspectorate under the Ministry of Finance of the Republic of Lithuania (Valstybinė mokesčių inspekcija)",
  },
  contact: {
    legalEmail: "legal@pinglide.com",
  },
  legal: {
    /** e.g. "1.0". Raise it on every published change. */
    version: "1.4",
    /** At least 30 days after announcing a change that is not in customers' favour. */
    effectiveDate: "17 November 2026",
  },
  billing: {
    /**
     * The legal entity that sells the plans, as it appears on a customer's own
     * invoice — **not** the brand name on the dashboard you log into.
     *
     * Stripe Managed Payments is the provider (since November 2026; Lemon
     * Squeezy before it, which stopped taking new stores). Buyers see the
     * purchase as "Sold through Link", and the terms, the privacy policy, the
     * DPA and the cookie policy all quote this string verbatim to customers.
     *
     * **So read it off a real receipt before relying on it**, and do not copy
     * it from documentation, a blog post or a search result. Naming the wrong
     * seller in a contract is not a typo.
     *
     * Empty means unset, and `lib/brand.ts`'s rule applies: nothing it feeds is
     * drawn. The legal documents are therefore incomplete until it is filled —
     * which is correct, because so is the arrangement they describe.
     *
     * TODO: confirm against a real test-mode receipt. Filled on 2026-11-17 from
     * link.com/terms, whose "Sold Through Link Terms" name the seller as Link,
     * LLC ("Link SMP"); Stripe's own docs name no entity. Which Stripe entity
     * contracts with a buyer depends on where they are
     * (link.com/terms/contracting-entity, not yet read).
     */
    merchantOfRecord: "Link, LLC (Stripe Managed Payments), trading as Link",
    merchantOfRecordTermsUrl: "https://link.com/terms#sold-through-link-terms",
  },
  hosting: {
    /** Legal name of whoever runs the dashboard and the measurement endpoint. */
    provider: "Appwrite Code Ltd. (Appwrite Sites)",
    /** e.g. "Frankfurt, Germany". */
    region: "European Union — Frankfurt, Germany",
  },
};

/**
 * Where a document is published, as a full address when the site's own is
 * known. The documents print these in running text — "the Terms of Service at
 * …" — where a bare `/terms` would mean nothing on paper.
 *
 * `brand.json`'s link wins when it is set, and the page's own path stands in
 * until then, so the documents link to one another before the footer does.
 */
function documentUrl(doc: LegalDocument): string {
  const href = BRAND.legal[doc.brandKey] ?? doc.path;
  return href.startsWith("/") && BRAND.website ? `${BRAND.website}${href}` : href;
}

export function legalPlaceholderValues(): PlaceholderValues {
  const dpaUrl = documentUrl(LEGAL_DOCUMENTS.dpa);

  return {
    name: BRAND.name,
    website: BRAND.website,

    "company.legalName": BRAND.company.legalName,
    "company.registrationNumber": BRAND.company.registrationNumber,
    "company.vatNumber": BRAND.company.vatNumber,
    "company.address": BRAND.company.address,
    "company.legalForm": LEGAL_DETAILS.company.legalForm,
    "company.register": LEGAL_DETAILS.company.register,

    "contact.supportEmail": BRAND.contact.supportEmail,
    "contact.privacyEmail": BRAND.contact.privacyEmail,
    "contact.legalEmail": LEGAL_DETAILS.contact.legalEmail,

    "legal.version": LEGAL_DETAILS.legal.version,
    "legal.effectiveDate": LEGAL_DETAILS.legal.effectiveDate,
    "legal.termsUrl": documentUrl(LEGAL_DOCUMENTS.terms),
    "legal.privacyUrl": documentUrl(LEGAL_DOCUMENTS.privacy),
    "legal.cookiesUrl": documentUrl(LEGAL_DOCUMENTS.cookies),
    "legal.dpaUrl": dpaUrl,
    "legal.refundsUrl": documentUrl(LEGAL_DOCUMENTS.refunds),
    // The DPA's own Annex III is the list (documents/company.md).
    "legal.subprocessorsUrl": `${dpaUrl}#annex-iii--sub-processors`,

    "billing.merchantOfRecord": LEGAL_DETAILS.billing.merchantOfRecord,
    "billing.merchantOfRecordTermsUrl":
      LEGAL_DETAILS.billing.merchantOfRecordTermsUrl,
    "hosting.provider": LEGAL_DETAILS.hosting.provider,
    "hosting.region": LEGAL_DETAILS.hosting.region,
  };
}
