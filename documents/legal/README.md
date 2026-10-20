# Legal documents — read this before publishing anything here

**Status: published 17 October 2026 (version 1.0), before the lawyer review.** Researched and
written on 13 September 2026 for Lithuanian law, business customers only. **This is not legal
advice.** They were published early because Google sign-in's consent screen needs a live privacy
policy and terms; every placeholder was filled and every `[VERIFY]` closed from the providers'
published pages, softening the sentence wherever a figure could not be confirmed. The lawyer
review (step 2) is still owed — especially the questions listed near the end — and so is one
check: **`billing.merchantOfRecord` was read off lemonsqueezy.com, not off a real invoice**
(`lib/legal/values.ts`). `lib/legal/placeholders.test.ts` fails if an edit makes any of the five a
draft again, which would 404 it in production. **Version 1.1 (19 October 2026)** added the Refund
Policy and Terms §6.5 / §6.9; it took effect on publish without the §21.2 notice because nobody was
on a paid Plan yet. From now on, an adverse change needs the 30 days.

| File | What it is | Page (`brand.json` link) | Where the app links it |
|---|---|---|---|
| [terms-of-service.md](terms-of-service.md) | The contract with customers | `/terms` (`legal.termsUrl`) | Sign-up and log-in consent notice (`components/brand/legal-consent-notice.tsx`), footer links (`components/brand/legal-links.tsx`) |
| [privacy-policy.md](privacy-policy.md) | What we do with personal data as a controller | `/privacy` (`legal.privacyUrl`) | Consent notice, footer links, email footer (`lib/email/templates/layout.ts`) |
| [cookie-policy.md](cookie-policy.md) | Cookies and browser storage, from the code | `/cookies` (`legal.cookiesUrl`) | Footer links |
| [data-processing-agreement.md](data-processing-agreement.md) | GDPR Art. 28 terms for visitor measurement and customer content | `/dpa` (`legal.dpaUrl`) | Measurement switch in the publish designer (`components/publish/design-sidebar/measurement-group.tsx`) |
| [refund-policy.md](refund-policy.md) | When a payment is refunded (almost never), chargebacks. Added 2026-10-19 with Terms v1.1 | `/refunds` (`legal.refundsUrl`) | Footer links, Terms §6.5 and key term 4, docs → Plans and billing → Cancelling |

Company and contact placeholders are defined one folder up, in [../company.md](../company.md) and
[../contact.md](../contact.md).

**How the pages work.** `app/(marketing)/{terms,privacy,cookies,dpa,refunds}` render these files as they
stand (`components/legal/`, `lib/legal/`), filling each `{{path}}` from `brand.json` or
`lib/legal/values.ts` at build time. **A document is a draft while any placeholder is unfilled or
any `[VERIFY]`, `[REMOVE IF UNUSED]` or `[IF USED]` marker is left.** A draft answers 404 in a
production build and, in development, renders under a notice listing what is missing — so
`npm run dev` and `/terms` is the quickest way to see what is still owed.

## Before you publish

1. ~~**Register the business.**~~ **Done 2026-10-11** as an *individuali veikla* (VMI certificate
   No. 1554078), not a company — so the contracting party is the person, with personal and
   unlimited liability ([../company.md](../company.md)). The VAT payer code (LT100020950510) and the
   public address were set in `brand.json` on 2026-10-17, so this step is complete. What
   registration does *not* give is a limit on personal liability — lawyer question 11.
2. **Have a Lithuanian lawyer review them**, starting with [the questions below](#questions-for-the-lawyer).
3. ~~**Fill every placeholder**~~ **Done 2026-10-17** (the merchant of record still to be checked
   against an invoice) — in `brand.json`, or in `LEGAL_DETAILS` in `lib/legal/values.ts`
   for the values `brand.json` has no field for. Not by find-and-replace in these files: the
   placeholders stay, so a value changed in `brand.json` changes in the documents too. The notice
   at the top of each page in development lists what is left.
4. ~~**Resolve every `[VERIFY: …]`**~~ **Done 2026-10-17**, and the rows below record how, in the [list below](#verify-items), then delete the marker.
   `grep -rn "\[VERIFY" documents/legal/` must return nothing.
5. ~~**Delete the rows that do not apply.**~~ **Done 2026-10-17**: Geoapify is in use, so its rows stay. Rows marked `[REMOVE IF UNUSED]` or `[IF USED]` are there
   for a service that may or may not be in use. Delete the row, or keep it and delete the marker. If
   `GEOCODER_PROVIDER` / `ROUTING_PROVIDER` are not `geoapify`, list whatever `GEOCODER_URL` /
   `ROUTING_URL` point at instead — and note that CLAUDE.md §12 says the public Photon and OSRM demo
   endpoints cannot carry paying customers at all.
6. **Make sure `{{contact.legalEmail}}` and `{{contact.privacyEmail}}` are monitored inboxes.** Both
   carry legal deadlines. They are meant to be Cloudflare Email Routing rules forwarding to the same
   Gmail as support@ (see [../contact.md](../contact.md)); send a test to each before publishing.
7. **Fix, or soften the text around, the [open code issues](#open-issues-in-the-code).**
8. ~~**Check a production build**~~ **Done 2026-10-17**, and the four `legal` URLs are set
   (`npm run build && npm start`): the four pages must now answer 200
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
| Courts | competent for Klaipėda (the owner's city) | Terms §23.2, Key terms 11; DPA Annex IV |
| Claim notice (mitigation only) | 60 days | Terms §18.4 |
| Force majeure termination | after 60 days | Terms §20.2 |
| Moderation complaint window | 6 months | Terms §11.4 |
| Visitor session records | 30 / 180 / 365 days (Free / Starter / Pro) | Privacy §6; DPA Annex I.B — from `SESSION_LIMITS` in `lib/repositories/plan-limits.ts` |
| Sign-in session | at most 1 year | Privacy §2; Cookie §2 |
| Security records / support messages / accounting records | 12 months / 24 months / 10 years | Privacy §2 |
| Audits | once per 12 months, 30 days' notice | DPA §8.2 |
| Data subject requests answered within | one month (+ two for complex requests) | Privacy §9 |
| Refund for failure that is our fault | after 7 consecutive days from written notice, pro-rata for the outage | Refund §4.3; Terms §6.5(c) |
| Billing error reported within (mitigation only) | 60 days | Refund §7.2 |
| Refund requests answered within | 14 days | Refund §7.1 |
| Uncorrected billing error that excuses a chargeback | 14 days after notice | Refund §9.3; Terms §6.9 |
| Lemon Squeezy's own refund discretion (theirs, not ours) | 60 days from purchase | Refund §8.2 — from LS's seller docs |

## `[VERIFY]` items

| # | Item | Where | How to close it |
|---|---|---|---|
| 1 | ~~Appwrite's contracting entity, its own sub-processors, and the safeguard~~ — **closed 2026-10-17**: Appwrite Code Ltd. (appwrite.io/privacy), its sub-processors by reference to its DPA, SCCs (its privacy policy). Still worth downloading the signed DPA from the console | Privacy §5; DPA Annex III | — |
| 2 | ~~Appwrite backup region and retention~~ — **closed 2026-10-17** by softening: "where the plan provides them". Backups are a Pro feature; the project may be on Free | Privacy §5; DPA Annex II | — |
| 3 | ~~Encryption at rest~~ — **closed 2026-10-17**: AES, per appwrite.io/docs/advanced/security/gdpr | DPA Annex II | — |
| 4 | ~~Automatic deletion of visitor session records by Plan~~ — **closed 2026-10-04**: built (`lib/analytics/retention.ts`), marker removed from both documents | Privacy §6; DPA Annex I.B | — |
| 5 | ~~Hosting provider~~ — **closed 2026-10-17**: `hosting.*` = Appwrite Code Ltd. (Appwrite Sites), Frankfurt | Privacy §5; DPA Annex III | — |
| 6 | ~~Resend's entity and log retention~~ — **closed 2026-10-17**: Plus Five Five, Inc. (resend.com/legal/dpa); logs "currently 30 days", from secondary pricing sources after Resend's March 2026 change | Privacy §2, §5 | — |
| 7 | ~~Checkout cookies~~ — **closed 2026-10-17** by category (essential, performance, functionality), as lemonsqueezy.com/privacy names no cookies | Cookie §4 | — |
| 8 | ~~DPO~~ — **closed 2026-10-17** with a reasoned "not required, reviewed as we grow"; lawyer question 2 still stands | Privacy §1 | — |
| 9 | ~~Data Act Art. 26(b)~~ — **closed 2026-10-17** by describing the formats in Terms §13.3 itself; lawyer question 8 still stands | Terms §13.3 | — |
| 10 | ~~PostHog~~ — **closed 2026-10-17**: PostHog Inc., EU cloud (Frankfurt), SCCs, retention "at most 7 years" (PostHog's longest plan retention). Confirm the project's retention setting | Privacy §2, §5 | — |

## Open issues in the code

These are true of the codebase today, and the documents either describe them honestly or depend on
them being fixed. Each needs a code change or a softer sentence before publishing.

1. ~~**Visitor session retention is not enforced.**~~ **Fixed 2026-10-04.** The scheduled function
   (`functions/sheet-sync`) walks `/api/cron/session-retention` once a day, in the 03:00 UTC hour,
   and `lib/analytics/retention.ts` deletes raw `mapSessions` past the owner's plan's
   `retentionDays`, folding any day with no rollup into `mapDaily` first. It depends on the function
   being deployed with the current code (`npm run setup:sheet-sync`) and on `CRON_SECRET`.
2. **The daily rollups (`mapDaily`) are kept forever** and contain search text, referrers and page
   paths. The documents say so. If that is not acceptable, add a retention period for them too.
3. ~~**There is no self-service account deletion.**~~ **Fixed.** Settings → Account → Delete account
   (`lib/account-deletion/`) deletes everything at once; Privacy §9 now says so.
4. **There is no data export.** Terms §13.3 promises export of all exportable data on request, which
   the Data Act requires. Until an export exists it is a manual job. CLAUDE.md §12 asks for an ODbL
   flag before building an export feature — Terms §10.8 puts ODbL compliance on the customer for data
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
10. **Usage measurement without storage.** PostHog runs on our website and dashboard with
    `persistence: "memory"`: nothing stored on the device, no banner. EDPB Guidelines 2/2023 say a
    script that makes a device send information can still need consent under Art. 61 even without
    storage. Is legitimate interest without a banner defensible for first-party product analytics, or
    is a consent banner needed — at least on the public website?
11. **Running as an individuali veikla.** The service is provided by a natural person under a VMI
    certificate, not a company, so liability is personal and unlimited. (a) ~~Which address to
    publish~~ — closed 2026-10-17: the owner chose to publish Debreceno g. 8-10, Klaipėda. (b) **No
    wording in these documents separates business debts from personal assets.** The cap (§18) binds
    only customers, only within Civil Code 6.252, and not Visitors, authorities or GDPR Art. 82
    claimants. Should the business move into a limited-liability entity before the paid launch — a
    *mažoji bendrija* (no minimum capital) or a UAB — and what does the transfer of customer
    contracts to it require (Terms §22 allows assignment to a successor)? (c) Which insurance
    covers the remaining exposure: professional (errors and omissions) liability, cyber liability, or
    both — and at what sum? (d) Is joint marital property within reach of the business's creditors,
    and does that change the answer to (b)?
12. **Visitor claims over inaccurate locations.** A Visitor who relies on a wrong pin is not a party
    to the Terms, so the cap does not bind them; a claim against us would be in tort (Civil Code
    6.263), which needs fault. The Terms answer it with: the customer owns and must check every
    position (§10.4), sync is an instruction to publish without review (§10.5), an exclusion
    (§10.7, §18.2), DSA hosting with no duty to monitor (§7.10), and an indemnity naming Visitor
    claims (§19.1(g)). Is that enough, or should Published Maps also carry a short accuracy notice to
    Visitors? (That costs embed bytes against a budget with ~600 left — CLAUDE.md §4 — so it is a
    question to answer before building, not after.)

13. **The Refund Policy's strictness.** It refunds nothing except the Terms' own four cases,
    billing errors, a failure through our fault lasting more than 7 consecutive days, and what the law
    requires (Refund §4). (a) Is that exception enough to keep the rest from being an
    "inappropriate" limit on remedies for non-performance (Data Act Art. 13(5)(a)) or unfair under
    Civil Code 6.186 — or should the threshold be shorter? (b) Is recovering a chargeback's dispute
    fee and reversed amount (Refund §9.2(b), Terms §6.9) enforceable as damages without an express
    checkbox at checkout, given lawyer question 4? (c) Is keeping the remaining months of an annual
    plan "proportionate" (question 6 again, now stated in Refund §3.1(b))?

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
| **DSA Arts. 6 and 8** — a hosting provider is not liable for content stored at a user's request without actual knowledge of illegality, and has no general obligation to monitor | eu-digital-services-act.com | Terms §7.10 says we store at the customer's request and do not check; §10.3–10.7 put accuracy on the customer |
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
| **Civil Code 6.237** — unjust enrichment: what was received without a legal basis must be returned | General principle | Refund §4.2: duplicate charges and charges after a confirmed cancellation are refunded as of right, not as goodwill |
| **Civil Code 6.71, 6.73** — a contractual penalty may be reduced by a court if excessive | General principle | Chargeback recovery (Refund §9.2(b), Terms §6.9) is limited to actual loss, not a fixed penalty like Lemon Squeezy's $100 |
| **Consumer Rights Directive 2011/83/EU** — 14-day right of withdrawal | Applies to consumers only | Not offered, since the Service is B2B only (Terms §3.2); Refund §1.3 keeps mandatory consumer law intact if a consumer buys anyway |
| **Data Act Art. 13(5)(a)** — terms that inappropriately limit remedies for non-performance are presumed unfair | eu-data-act.com | Refund §4.3, the narrow refund for a failure that is our fault, so that "no refunds" is not "no remedy" |
| **Lemon Squeezy refunds and chargebacks** — LS may refund within 60 days at its own discretion to prevent chargebacks, and charges the seller the amount plus a $15 dispute fee | docs.lemonsqueezy.com; LS buyer terms | Refund §8 says so rather than promising a strictness we cannot enforce; §6.3 ends the paid period for whatever LS refunds |
| **EU-US Data Privacy Framework** — valid; upheld by the General Court on 3 Sep 2025; appeal C-703/25 P pending | IAPP; WilmerHale | SCCs relied on as well, so transfers survive if it falls |

## Rivals compared

None of them publishes a cookie policy or a DPA, so both of ours go beyond the market.

| Rival | Governing law | Taken | Refused, and why |
|---|---|---|---|
| **Atlist** | Ontario | "As is" disclaimer; customer indemnity; auto-renewal; 30-day notice of price rises; removing maps that break the terms | Total exclusion of all damages (void under Civil Code 6.252); termination "at any time, for any reason, and without advance notice" (Data Act grey list; DSA Art. 17 needs reasons) |
| **Storemapper** | British Columbia | Cap tied to fees; no refunds; no compensation for downtime; publicity; free assignment by the provider; force majeure | Deleting all content on the termination date (Data Act requires a retrieval period) |
| **Stockist** | Not stated | Publicity until told not to; caveat about CDN and backup copies; cap on aggregate fees | Changing terms "at any time, with no notice" (DSA Art. 14(2)); a one-year limitation period (Civil Code 1.125) |
| **StoreRocket** | United Kingdom | Refunds only at the provider's discretion | Changing terms "at any time without notice" (as above) |

**Refunds specifically** (read 2026-10-19). Ours is stricter than all four: none of them has a
permanent free plan, so three of them offer a money-back window instead. Ours does not, because the
Free Plan is the trial (Refund §2).

| Rival | Refund stance | Taken | Refused, and why |
|---|---|---|---|
| **Storemapper** | Nothing refunded for partial months, plan changes or moving to free; minimum term of a month or a year; but a one-off 30-day money-back window | The full list of no-refund cases; downgrade = no refund; annual = the whole year | The money-back window |
| **Stockist** | Any payment refunded within 30 days; after that at its discretion; "quota has no value, does not accrue, is not refundable" | Allowances have no value and do not roll over (Refund §3.1(g)) | The 30-day refund |
| **StoreRocket** | Within 30 days, case by case, "subject to fair usage"; cancelling is the customer's job | Fair use as a ground to refuse goodwill (§5.3); cancelling is the customer's job (§3.1(c)) | The 30-day window |
| **Atlist** | Silent on refunds; fees incurred on day 1; charges "deemed accurate" unless disputed within 10 days | Fees earned on day 1 (§3.1) | The 10-day deeming, which works as a shortened limitation period (Civil Code 1.125); Refund §7.2 is a mitigation-only notice, like Terms §18.4 |
| **Lemon Squeezy** (our MoR) | Buyer terms: refunds at its sole discretion, none for unused subscription periods, contact it before a chargeback | Contact us before a chargeback (§9.1) | — its own 60-day discretion cannot be overridden, so §8.2 says so |

## Sources

- Atlist terms — https://www.atlist.com/terms · privacy — https://www.atlist.com/privacy
- Storemapper terms — https://www.storemapper.com/terms
- Stockist terms — https://stockist.co/terms
- StoreRocket terms — https://storerocket.io/terms
- Lemon Squeezy refunds and chargebacks — https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks ·
  buyer terms — https://www.lemonsqueezy.com/buyer-terms
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
