# Company information

Every document in [`legal/`](legal/) names the company, the product and the services behind it
through placeholders written as `{{path}}`. This file defines them.

**Do not find-and-replace them in the Markdown.** The pages at `/terms`, `/privacy`, `/cookies`
and `/dpa` fill them as they render: from `brand.json` where the field exists there, and from
`LEGAL_DETAILS` in `lib/legal/values.ts` where it does not. Record the value in the table below
too, so this file stays the readable list. In development each page opens with a notice naming
whatever is still unfilled.

**Where a field also exists in `brand.json`, the placeholder uses the same path**, so the two can
be filled from one source and cannot quietly disagree. `brand.json` ships to the browser, so
everything below is public information by design — nothing secret belongs in either file.

Contact addresses live in [contact.md](contact.md).

## Company

| Placeholder | What it is | In `brand.json` | Value |
|---|---|---|---|
| `{{company.legalName}}` | Registered name, exactly as on the register extract, e.g. `UAB „Example"` | `company.legalName` | Pinglide — **a stand-in until the company is registered**; replace it with the registered name |
| `{{company.legalForm}}` | Legal form in words, e.g. "private limited liability company (UAB)" | — (`lib/legal/values.ts`) | |
| `{{company.registrationNumber}}` | Company code (*juridinio asmens kodas*) | `company.registrationNumber` | |
| `{{company.register}}` | The register holding the company. For a Lithuanian company: "Register of Legal Entities of the Republic of Lithuania, kept by the State Enterprise Centre of Registers" | — (`lib/legal/values.ts`) | |
| `{{company.vatNumber}}` | VAT payer code, `LT` followed by digits. **If the company is not VAT-registered, delete the sentence that uses it** rather than leaving it blank | `company.vatNumber` | |
| `{{company.address}}` | Registered office address | `company.address` | |

The Law on Information Society Services (Art. 5) requires the name, address, register and
registration number, contact email and VAT payer code to be freely and permanently available to
users. Terms of Service §1 carries all of them; do not remove that section to shorten the page.

## Product

| Placeholder | What it is | In `brand.json` | Value |
|---|---|---|---|
| `{{name}}` | Product name, as customers see it | `name` | Pinglide |
| `{{website}}` | Public site, full `https://` address | `website` | https://pinglide.com |

## Legal documents

| Placeholder | What it is | In `brand.json` | Value |
|---|---|---|---|
| `{{legal.version}}` | Version of the document set, e.g. `1.0`. Raise it on every published change | — (`lib/legal/values.ts`) | |
| `{{legal.effectiveDate}}` | Date this version takes effect. For a change that is not purely in customers' favour, at least **30 days** after it is announced (Terms §21) | — (`lib/legal/values.ts`) | |
| `{{legal.termsUrl}}` | Where `terms-of-service.md` is published. Until `brand.json` sets it, the page's own address is used | `legal.termsUrl` | /terms |
| `{{legal.privacyUrl}}` | Where `privacy-policy.md` is published | `legal.privacyUrl` | /privacy |
| `{{legal.cookiesUrl}}` | Where `cookie-policy.md` is published | `legal.cookiesUrl` | /cookies |
| `{{legal.dpaUrl}}` | Where `data-processing-agreement.md` is published | `legal.dpaUrl` | /dpa |
| `{{legal.subprocessorsUrl}}` | Where the current sub-processor list lives. The DPA's own Annex III is enough: `{{legal.dpaUrl}}#annex-iii--sub-processors` | — (derived in `lib/legal/values.ts`) | /dpa#annex-iii--sub-processors |

## Billing and infrastructure

These are undecided in the codebase today, which is why they are placeholders rather than names.
All four are filled in `lib/legal/values.ts`.

| Placeholder | What it is | Value |
|---|---|---|
| `{{billing.merchantOfRecord}}` | Legal name of the merchant of record once chosen — CLAUDE.md §3 says Paddle or Lemon Squeezy, e.g. "Paddle.com Market Limited" | |
| `{{billing.merchantOfRecordTermsUrl}}` | Its terms for buyers | |
| `{{hosting.provider}}` | Legal name of whoever runs the dashboard and the visitor-measurement endpoint. Appwrite Sites or Vercel — see `docs/notes/analytics.md` | |
| `{{hosting.region}}` | Where it runs, e.g. "Frankfurt, Germany" | |

## Before any of this is published

The documents name a company as the party customers contract with. **Until that company is
registered, publishing them makes the person running the service the contracting party instead,
with personal and unlimited liability** — none of the protection the documents were written to
give. Register first, fill this file, then publish. The full checklist is in
[legal/README.md](legal/README.md).
