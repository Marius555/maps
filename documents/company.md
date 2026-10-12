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

**The service is run as an *individuali veikla*** (a natural person carrying out individual
activity under a VMI certificate), not a company: certificate FR0468 No. 1554078, activity from
2026-10-11, EVRK 582900 *Kita programinės įrangos leidyba* (other software publishing). The
documents are worded for that. If it ever becomes a UAB, the values below change and so does the
wording around them ("individual activity certificate No." → "company code", "address" →
"registered office").

| Placeholder | What it is | In `brand.json` | Value |
|---|---|---|---|
| `{{company.legalName}}` | For an individuali veikla, the person's name as on the certificate. For a company, the registered name, e.g. `UAB „Example"` | `company.legalName` | Marius Zakarauskas |
| `{{company.legalForm}}` | Legal form in words | — (`lib/legal/values.ts`) | natural person carrying out individual activity (individuali veikla) |
| `{{company.registrationNumber}}` | The individual activity certificate number. **Never the personal code (*asmens kodas*) printed on the same certificate** — that is not public, and the certificate number is what identifies an individuali veikla (it is what goes on its invoices) | `company.registrationNumber` | 1554078 |
| `{{company.register}}` | Who keeps the registration | — (`lib/legal/values.ts`) | State Tax Inspectorate under the Ministry of Finance of the Republic of Lithuania (Valstybinė mokesčių inspekcija) |
| `{{company.vatNumber}}` | VAT payer code, `LT` followed by digits. **If VAT registration does not happen, delete the sentence that uses it** (Terms §1) rather than leaving it blank | `company.vatNumber` | pending, as of 2026-10-12 |
| `{{company.address}}` | Address. An individuali veikla has no registered office, so this would be the declared home address — **the owner has decided not to publish that** | `company.address` | not set, deliberately (see below) |

The Law on Information Society Services (Art. 5) requires the name, address, register and
registration number, contact email and VAT payer code to be freely and permanently available to
users. Terms of Service §1 carries all of them; do not remove that section to shorten the page.

**The address is the one that blocks.** Art. 5 asks for a geographic address, and the DPA's SCC
annex names the importer's address, so the four pages stay drafts — 404 in production — while it
is empty. That is the intended state, not a bug to route around: do not delete the placeholder
from the documents to make them publish. The way out without exposing a home address is a
correspondence or virtual-office address; whether that satisfies Art. 5 for an individuali veikla
is lawyer question 11 in [legal/README.md](legal/README.md).

**Personal details stay on the legal pages.** The site footer (`components/brand/company-details.tsx`)
and the email footer (`lib/email/templates/layout.ts`) print the product name and the support
address only, by the owner's choice — they do not read `company.*`.

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

Registration is done (2026-10-11). Know what it does and does not give: **an individuali veikla is
the person, so liability for the business is personal and unlimited** — there is no company in
between. The Terms' liability cap (§18) still limits what a customer can claim under the contract,
within what Lithuanian law allows, but nothing separates business debts from personal ones.
Whether that is acceptable at the scale the plans are sized for, or a UAB is needed first, is
lawyer question 11. What is left before publishing — the address, the VAT code and the rest — is
the checklist in [legal/README.md](legal/README.md).
