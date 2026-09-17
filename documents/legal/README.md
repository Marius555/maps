# Legal documents — read this before publishing anything here

**Status: draft.** Researched and written on 13 September 2026 for Lithuanian law, business customers
only. **This is not legal advice.** The drafts lean as far towards the provider as the checks below
allowed, and a Lithuanian lawyer should review them before they bind anyone — especially the
questions listed near the end.

| File | What it is | Page (`brand.json` link) | Where the app links it |
|---|---|---|---|
| [terms-of-service.md](terms-of-service.md) | The contract with customers | `/terms` (`legal.termsUrl`) | Sign-up and log-in consent notice (`components/brand/legal-consent-notice.tsx`), footer links (`components/brand/legal-links.tsx`) |
| [privacy-policy.md](privacy-policy.md) | What we do with personal data as a controller | `/privacy` (`legal.privacyUrl`) | Consent notice, footer links, email footer (`lib/email/templates/layout.ts`) |
| [cookie-policy.md](cookie-policy.md) | Cookies and browser storage, from the code | `/cookies` (`legal.cookiesUrl`) | Footer links |
| [data-processing-agreement.md](data-processing-agreement.md) | GDPR Art. 28 terms for visitor measurement and customer content | `/dpa` (`legal.dpaUrl`) | Measurement switch in the publish designer (`components/publish/design-sidebar/measurement-group.tsx`) |

Company and contact placeholders are defined one folder up, in [../company.md](../company.md) and
[../contact.md](../contact.md).

**How the pages work.** `app/(marketing)/{terms,privacy,cookies,dpa}` render these files as they
stand (`components/legal/`, `lib/legal/`), filling each `{{path}}` from `brand.json` or
`lib/legal/values.ts` at build time. **A document is a draft while any placeholder is unfilled or
any `[VERIFY]`, `[REMOVE IF UNUSED]` or `[IF USED]` marker is left.** A draft answers 404 in a
production build and, in development, renders under a notice listing what is missing — so
`npm run dev` and `/terms` is the quickest way to see what is still owed.

## Before you publish

1. **Register the company.** The documents name `{{company.legalName}}` as the party customers
   contract with. Published before it exists, they make the person running the service the
   contracting party, with unlimited personal liability.
2. **Have a Lithuanian lawyer review them**, starting with [the questions below](#questions-for-the-lawyer).
3. **Fill every placeholder** — in `brand.json`, or in `LEGAL_DETAILS` in `lib/legal/values.ts`
   for the values `brand.json` has no field for. Not by find-and-replace in these files: the
   placeholders stay, so a value changed in `brand.json` changes in the documents too. The notice
   at the top of each page in development lists what is left.
4. **Resolve every `[VERIFY: …]`** in the [list below](#verify-items), then delete the marker.
   `grep -rn "\[VERIFY" documents/legal/` must return nothing.
5. **Delete the rows that do not apply.** Rows marked `[REMOVE IF UNUSED]` or `[IF USED]` are there
   for a service that may or may not be in use. Delete the row, or keep it and delete the marker. If
   `GEOCODER_PROVIDER` / `ROUTING_PROVIDER` are not `geoapify`, list whatever `GEOCODER_URL` /
   `ROUTING_URL` point at instead — and note that CLAUDE.md §12 says the public Photon and OSRM demo
   endpoints cannot carry paying customers at all.
6. **Make sure `{{contact.legalEmail}}` and `{{contact.privacyEmail}}` are monitored inboxes.** Both
   carry legal deadlines.
7. **Fix, or soften the text around, the [open code issues](#open-issues-in-the-code).**
8. **Check a production build** (`npm run build && npm start`): the four pages must now answer 200
   rather than 404. **Then set the four `legal` URLs in `brand.json`** to `/terms`, `/privacy`,
   `/cookies` and `/dpa`. Setting a URL is what turns its link on in the app — `lib/brand.ts`
   draws nothing for an empty string — so do it only once the pages are live, or the footer
   links to a 404.

## Conventions

- `{{path}}` — a value to fill in. Defined in `../company.md` or `../contact.md`, using the
  `brand.json` path wherever that field exists.
- `[VERIFY: …]` — a fact that could not be confirmed from a primary source while writing.
- `[REMOVE IF UNUSED]` / `[IF USED]` — a row that depends on which provider is actually in use.

## Numbers that must agree across the documents

Change one of these and change it everywhere it appears.

| What | Value | Where |
|---|---|---|
| Notice of a change to the Terms that works against the customer | 30 days | Terms §21.2; DPA §12.2 |
| Notice of a price change | 30 days before renewal | Terms §6.4 |
| Notice of a material reduction in a paid feature | 30 days | Terms §4.2 |
| Notice before withdrawing the Free Plan | 30 days | Terms §4.3 |
| Termination by us for convenience | 30 days' notice, pro-rata refund | Terms §12.3 |
| Failed payment fixed within | 7 days | Terms §6.6 |
| Breach remedied within | 14 days | Terms §12.4 |
| Inactive Free account closure | 12 months without login, 30 days' notice | Terms §12.6 |
| Sub-processor change notice / objection window | 14 days | DPA §6.3, §6.4 |
| Switching: notice / transition / retrieval | 2 months / 30 days (max 7 months) / at least 30 days | Terms §13.1, §13.2, §13.4 |
| Export window after any other ending | 30 days | Terms §13.7; DPA §10.2; Privacy §8 |
| Deletion after that window | within 60 days, backups within 30 more | Terms §13.7; DPA §10.2; Privacy §8 |
| Liability cap | fees paid in the previous 12 months, or EUR 50 if more | Terms §18.3, Key terms 3 |
| Claim notice (mitigation only) | 60 days | Terms §18.4 |
| Force majeure termination | after 60 days | Terms §20.2 |
| Moderation complaint window | 6 months | Terms §11.4 |
| Visitor session records | 30 / 180 / 365 days (Free / Starter / Pro) | Privacy §6; DPA Annex I.B — from `SESSION_LIMITS` in `lib/repositories/plan-limits.ts` |
| Sign-in session | at most 1 year | Privacy §2; Cookie §2 |
| Security records / support messages / accounting records | 12 months / 24 months / 10 years | Privacy §2 |
| Audits | once per 12 months, 30 days' notice | DPA §8.2 |
| Data subject requests answered within | one month (+ two for complex requests) | Privacy §9 |

## `[VERIFY]` items

| # | Item | Where | How to close it |
|---|---|---|---|
| 1 | Appwrite's contracting entity, its own sub-processors, and the safeguard for any access from outside the EEA | Privacy §5; DPA Annex III | Download the DPA from Appwrite console → Organisation settings |
| 2 | Appwrite backup region and retention on the plan actually in use (Pro: daily, 7 days) | Privacy §5; DPA Annex II | Appwrite console → Databases → Backups; appwrite.io/docs/products/databases/backups |
| 3 | Encryption at rest of Appwrite's primary database and file storage | DPA Annex II | Appwrite DPA or security page |
| 4 | Automatic deletion of visitor session records by Plan **is not implemented** — `retentionDays` is defined but nothing reads it | Privacy §6; DPA Annex I.B | See open code issue 1 |
| 5 | Hosting provider for the dashboard and measurement endpoint, and its transfer safeguard | Privacy §5; DPA Annex III | Decide Appwrite Sites vs Vercel (`docs/notes/analytics.md`) |
| 6 | Resend's contracting entity and how long it keeps delivery logs | Privacy §2, §5 | resend.com/legal/dpa and resend.com/legal/subprocessors |
| 7 | Which cookies the Merchant of Record's checkout sets | Cookie §4 | The Merchant of Record's cookie policy, once chosen |
| 8 | Whether a data protection officer is required (GDPR Art. 37(1)(b)) once visitor measurement runs at scale | Privacy §1 | Lawyer question 2 |
| 9 | Whether Data Act Art. 26(b) is met by describing export formats on request, or needs a published register | Terms §13.3 | Lawyer question 8 |

## Open issues in the code

These are true of the codebase today, and the documents either describe them honestly or depend on
them being fixed. Each needs a code change or a softer sentence before publishing.

1. **Visitor session retention is not enforced.** `SESSION_LIMITS[plan].retentionDays` (30/180/365)
   exists in `lib/repositories/plan-limits.ts`, but no code in `lib/`, `app/` or `components/` reads
   it, and nothing deletes old `mapSessions` rows. The Privacy Policy and DPA promise those periods.
   Build the purge, or change both documents to "until the map is deleted".
2. **The daily rollups (`mapDaily`) are kept forever** and contain search text, referrers and page
   paths. The documents say so. If that is not acceptable, add a retention period for them too.
3. **There is no self-service account deletion** (`lib/auth/account.ts` has none). The Privacy
   Policy says deletion is by email request, which is lawful but slow at scale.
4. **There is no data export.** Terms §13.3 promises export of all exportable data on request, which
   the Data Act requires. Until an export exists it is a manual job. CLAUDE.md §12 asks for an ODbL
   flag before building an export feature — Terms §10.4 puts ODbL compliance on the customer for data
   they take out.
5. **The measurement panel says "No cookies"** (`components/publish/design-sidebar/measurement-group.tsx`)
   but not that consent may still be needed (EDPB Guidelines 2/2023). The Terms, DPA and Cookie
   Policy put that decision on the customer; the panel's copy could say it too.
6. **Two persistent preference items** — the `sidebar_collapsed` cookie (1 year) and `heroui-theme`
   in local storage — sit in the grey zone of WP29 Opinion 04/2012, which exempts interface
   preferences clearly for session-length storage. The Cookie Policy argues they are set on an
   explicit choice. A session-length cookie would remove the question.

## Questions for the lawyer

1. **DPA §3.4 — anonymisation as a Customer instruction.** A processor that uses data for its own
   purposes risks becoming a controller. Is framing it as a documented instruction enough?
2. **Data protection officer.** Does large-scale visitor measurement on customers' behalf make
   Art. 37(1)(b) GDPR apply to us as processor?
3. **The liability cap** (12 months of fees, EUR 50 floor). Is it defensible against Civil Code
   Art. 6.186(4) and the Data Act Art. 13 grey list for the Free Plan and small subscriptions?
4. **Surprising terms (Civil Code Art. 6.186(2)).** The sign-up notice says "By continuing, you agree"
   with links, and the Terms open with a key-terms summary. Is that "express agreement after proper
   disclosure" for the cap, no-refund and deletion terms — or is a checkbox needed? (The notice
   avoids a checkbox on purpose: "Continue with Google" has no form to put one in.)
5. **Visitor consent.** Does the measurement beacon need Visitor consent under Art. 61 of the Law on
   Electronic Communications, in light of EDPB Guidelines 2/2023? That decides how the product talks
   about it, not just the documents.
6. **Early-termination charge.** Data Act recital 89 allows "proportionate" early-termination
   charges. Is keeping a prepaid annual fee proportionate?
7. **Language.** Is English-only acceptable for Lithuanian business customers, or should a Lithuanian
   version be offered?
8. **Data Act Art. 26(b).** Does "a description of formats on request" meet it?
9. **DSA classification.** Is the Service only a hosting service, or also an "online platform"
   (it stores customer content and disseminates it to the public)? If a platform, the micro and small
   enterprise exemption in DSA Art. 19 applies until we outgrow it — the Terms already cover Arts. 11,
   12, 14, 16, 17 and 18 either way.

## Legal checks performed

Each row is a rule that limits how one-sided the documents may be, and what it changed.

| Rule | Checked against | Effect on the documents |
|---|---|---|
| **Civil Code 6.252** — liability for intent or gross negligence cannot be excluded or capped; nor for injury to health, loss of life or non-pecuniary damage; nor mandatory norms | Verbatim text, temidy.lt | Terms §18.1 carve-outs. Atlist's total exclusion would be void here, so it was not copied |
| **Civil Code 6.185** — standard terms bind a business if it had a proper chance to read them | Verbatim text, temidy.lt | Terms §3.1 matches the existing sign-up notice |
| **Civil Code 6.186** — surprising standard terms are void unless properly disclosed and expressly accepted; unfair liability limits can be challenged | Verbatim text, temidy.lt | The key-terms summary at the top of the Terms |
| **Civil Code 1.125** — limitation periods cannot be changed by agreement | eteismai.lt, temidy.lt | No shortened claim period (Stockist has one). Terms §18.4 is a notice duty for mitigation only |
| **Data Act Art. 13** — B2B terms on data, liability and termination: blacklist (intent, gross negligence, no remedies) and grey list (short-notice termination, unjustified unilateral changes, blocking data copies) | eu-data-act.com | 30-day notice for our convenience termination; valid reasons stated for changes, with a right to leave; export always available; severability |
| **Data Act Art. 23–31, recital 89** — switching rules for all SaaS since 12 Sep 2025, no SME exemption in force (the Digital Omnibus relief is still a proposal); switching charges banned from 12 Jan 2027; proportionate early-termination charges allowed | Lawcel; Osborne Clarke; Greenberg Traurig; Bird & Bird | Terms §13 in full; no switching charges; §13.6 early-termination charge |
| **DSA Arts. 11, 12, 14, 16, 17, 18** — apply to every hosting provider regardless of size; Art. 15 reports and the online-platform section are exempt for micro and small enterprises | eu-digital-services-act.com; Bird & Bird | Terms §11 and §12.5; changes announced (§21.2); Lithuania's Digital Services Coordinator is RRT |
| **Law on Information Society Services, Art. 5** — name, address, register and number, email, supervising institution, VAT code | Baltic Times summary of the law | Terms §1; `../company.md` |
| **GDPR Art. 28** — the contents of a processing contract | gdpr-info.eu | DPA §5 covers (a)–(h); §6 covers Art. 28(2) and (4) |
| **SCC liability** — liability under the SCCs cannot be capped between the parties | European Commission SCC Q&A, via Mayer Brown | DPA §11.2(b) |
| **CJEU C-537/23 *Lastre*** — one-sided jurisdiction clauses are valid if limited to EU or Lugano courts and objectively defined | Jones Day; EAPIL | Terms §23.2 |
| **Law on Electronic Communications Art. 61, VDAI** — consent for anything not strictly necessary; legitimate interest is not enough | Sorainen; CookieSentry | Cookie Policy §3 |
| **WP29 Opinion 04/2012** — interface-preference cookies are exempt clearly when session-length | Future of Privacy Forum; WP29 | Open code issue 6 |
| **EDPB Guidelines 2/2023** — Art. 5(3) ePrivacy covers pixels and scripts that send data, not only cookies | EDPB; Hunton | Terms §8.3; DPA §4.1; Cookie Policy §5 |
| **Late Payment Directive** — ECB rate + 8 points, EUR 40 per invoice, B2B | Your Europe; EUR-Lex | Terms §6.6, only where we invoice directly |
| **Accounting records** — 10 years in Lithuania | Leinonen; RoboLabs | Privacy §2 |
| **EU-US Data Privacy Framework** — valid; upheld by the General Court on 3 Sep 2025; appeal C-703/25 P pending | IAPP; WilmerHale | SCCs relied on as well, so transfers survive if it falls |

## Rivals compared

None of them publishes a cookie policy or a DPA, so both of ours go beyond the market.

| Rival | Governing law | Taken | Refused, and why |
|---|---|---|---|
| **Atlist** | Ontario | "As is" disclaimer; customer indemnity; auto-renewal; 30-day notice of price rises; removing maps that break the terms | Total exclusion of all damages (void under Civil Code 6.252); termination "at any time, for any reason, and without advance notice" (Data Act grey list; DSA Art. 17 needs reasons) |
| **Storemapper** | British Columbia | Cap tied to fees; no refunds; no compensation for downtime; publicity; free assignment by the provider; force majeure | Deleting all content on the termination date (Data Act requires a retrieval period) |
| **Stockist** | Not stated | Publicity until told not to; caveat about CDN and backup copies; cap on aggregate fees | Changing terms "at any time, with no notice" (DSA Art. 14(2)); a one-year limitation period (Civil Code 1.125) |
| **StoreRocket** | United Kingdom | Refunds only at the provider's discretion | Changing terms "at any time without notice" (as above) |

## Sources

- Atlist terms — https://www.atlist.com/terms · privacy — https://www.atlist.com/privacy
- Storemapper terms — https://www.storemapper.com/terms
- Stockist terms — https://stockist.co/terms
- StoreRocket terms — https://storerocket.io/terms
- Civil Code 6.185 — https://www.temidy.lt/kodeksai/civilinis-kodeksas/6-185-straipsnis
- Civil Code 6.186 — https://www.temidy.lt/kodeksai/civilinis-kodeksas/6-186-straipsnis
- Civil Code 6.252 — https://www.temidy.lt/kodeksai/civilinis-kodeksas/6-252-straipsnis
- Civil Code 1.125 — https://www.temidy.lt/kodeksai/civilinis-kodeksas/1-125-straipsnis
- Data Act Art. 13 — https://www.eu-data-act.com/Data_Act_Article_13.html
- Data Act switching — https://lawcel.com/blog/data-act-switching-saas-exit-fees-2027 ·
  https://www.osborneclarke.com/insights/data-act-part-4-data-act-regulates-cloud-switching-and-influences-contractual-relationship
- Data Act early-termination charges — https://www.twobirds.com/da/insights/2025/the-data-act-what-mandatory-switching-rights-mean-for-fixed-term-saas-models
- Digital Omnibus status — https://www.gtlaw.com/en/insights/2026/7/eu-digital-omnibus-package-proposes-amendments-to-data-act
- DSA Art. 14 — https://www.eu-digital-services-act.com/Digital_Services_Act_Article_14.html ·
  Art. 16 — https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html ·
  Art. 17 — https://www.eu-digital-services-act.com/Digital_Services_Act_Article_17.html
- Lithuania's Digital Services Coordinator — https://www.rrt.lt/en/?p=41701
- Law on Information Society Services — https://www.baltictimes.com/news/articles/17333/
- GDPR Art. 28 — https://gdpr-info.eu/art-28-gdpr/
- SCC Q&A on liability — https://www.mayerbrown.com/en/insights/publications/2022/06/european-commissions-qanda-on-the-new-standard-contractual-clauses
- *Lastre* — https://www.jonesday.com/en/insights/2025/05/cjeu-ruling-on-asymmetric-jurisdiction-clause-validitytowards-uncertainty
- Lithuanian cookie rules — https://www.sorainen.com/publications/what-are-the-legal-requirements-for-the-use-of-cookies/ ·
  https://cookiesentry.com/cookie-consent/lithuania
- WP29 Opinion 04/2012 — https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2012/wp194_en.pdf
- EDPB Guidelines 2/2023 — https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
- Late payment — https://europa.eu/youreurope/business/finance-and-tax/making-receiving-payments/late-payment/index_en.htm
- Lithuanian accounting retention — https://leinonen.eu/ltu/news/accounting-in-lithuania/
- EU-US Data Privacy Framework status — https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework
- VDAI contact — https://vdai.lrv.lt/lt/struktura-ir-kontaktai/kontaktai-1/
- Appwrite session length — https://appwrite.io/docs/advanced/security/authentication ·
  session fields — https://appwrite.io/docs/references/cloud/models/session ·
  password hashing — https://appwrite.io/docs/products/auth/security ·
  backups — https://appwrite.io/docs/products/databases/backups
- Resend DPA and Data Privacy Framework — https://resend.com/legal/dpa
- Geoapify — https://www.geoapify.com/privacy-policy/
- OpenFreeMap privacy — https://openfreemap.org/privacy/
