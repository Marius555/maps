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
    /** In words, e.g. "private limited liability company (UAB)". */
    legalForm: "",
    /**
     * For a Lithuanian company: "Register of Legal Entities of the Republic of
     * Lithuania, kept by the State Enterprise Centre of Registers".
     */
    register: "",
  },
  contact: {
    legalEmail: "legal@pinglide.com",
  },
  legal: {
    /** e.g. "1.0". Raise it on every published change. */
    version: "",
    /** At least 30 days after announcing a change that is not in customers' favour. */
    effectiveDate: "",
  },
  billing: {
    /** e.g. "Paddle.com Market Limited", once chosen. */
    merchantOfRecord: "",
    merchantOfRecordTermsUrl: "",
  },
  hosting: {
    /** Legal name of whoever runs the dashboard and the measurement endpoint. */
    provider: "",
    /** e.g. "Frankfurt, Germany". */
    region: "",
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
    // The DPA's own Annex III is the list (documents/company.md).
    "legal.subprocessorsUrl": `${dpaUrl}#annex-iii--sub-processors`,

    "billing.merchantOfRecord": LEGAL_DETAILS.billing.merchantOfRecord,
    "billing.merchantOfRecordTermsUrl":
      LEGAL_DETAILS.billing.merchantOfRecordTermsUrl,
    "hosting.provider": LEGAL_DETAILS.hosting.provider,
    "hosting.region": LEGAL_DETAILS.hosting.region,
  };
}
