# Privacy Policy

**{{name}}** · Version {{legal.version}} · Effective {{legal.effectiveDate}}

This policy explains how {{company.legalName}} ("**we**", "**us**") processes personal data when you
visit our website, create or use a {{name}} account, or contact us.

**It does not cover the websites where our customers publish maps.** When a map made with {{name}}
is shown on a customer's website, that customer decides what is collected about the people using it,
and is responsible for it; we process that data on the customer's behalf. §6 explains what that
means if you used one of those maps.

## 1. Who is responsible

The controller is **{{company.legalName}}**, company code {{company.registrationNumber}},
{{company.address}}.

Write to **{{contact.privacyEmail}}** about anything in this policy. We have not appointed a data
protection officer.
[VERIFY: GDPR Art. 37(1)(b) — confirm that no data protection officer is required once visitor
measurement for customers runs at scale.]

## 2. What we collect, why, and on what legal basis

"Legal basis" refers to Article 6(1) of the General Data Protection Regulation (GDPR).

| What we do | Personal data | Legal basis | How long we keep it |
|---|---|---|---|
| **Run your account** | Name, email address, password (stored only as a salted Argon2 hash, never readable), your Plan and account settings. If you choose "Continue with Google": the account identifier, name and email address Google shares with us | (b) contract | For the life of your account, then as in §8 |
| **Sign you in and keep accounts secure** | Session records: IP address, browser, operating system, device type, country, and times. The sign-in cookie (see the [Cookie Policy]({{legal.cookiesUrl}})). Records of password-reset and email-confirmation requests | (f) our legitimate interest in keeping the Service and accounts secure | Session records until the session ends or expires (at most 1 year); security records up to 12 months |
| **Send service emails** — confirming your address, resetting your password, and notices about your account, billing and changes to our terms | Email address, name, message content, delivery status | (b) contract; (c) legal obligation, for notices the law requires | Delivery logs as kept by our email provider [VERIFY: Resend log retention period] |
| **Host what you put into the Service** | Customer Content, which may include personal data such as contact names, phone numbers, email addresses and photos | We process it for our customer under our [Data Processing Agreement]({{legal.dpaUrl}}). For your own details in it: (b) contract | As set out in §8 |
| **Bill paid Plans** | The Merchant of Record handles payment details — we never see card numbers. We receive: name, email address, company name, billing country and address, VAT number, Plan, amounts and subscription status | (b) contract; (c) accounting and tax law | Accounting records for 10 years, as Lithuanian accounting law requires; the rest for the life of your account |
| **Answer support requests** | Your messages, and anything you tell us in them | (b) contract; (f) our legitimate interest in helping users | 24 months after the last message |
| **Operate our servers** | Technical request logs: IP address, address requested, time, browser, error details | (f) our legitimate interest in running, securing and fixing the Service | As kept by our hosting provider, and no more than 12 months where we control it |
| **Improve the Service** | How the dashboard is used, in anonymous and aggregated form | (f) our legitimate interest in improving the Service | Anonymous data is not personal data |
| **Protect our legal position** | Any of the above that is relevant to a claim, dispute or request from an authority | (c) legal obligation; (f) our legitimate interest in establishing, exercising or defending legal claims | As long as needed, up to the end of the applicable limitation period |
| **Tell customers about product news** | Name, email address | (f) our legitimate interest, for existing customers about similar services — or your consent. You can opt out in every email | Until you opt out |

We do **not** currently use any third-party analytics, advertising or tracking tools on our website or
dashboard. If we add any, we will update this policy first, and ask for your consent where the law
requires it.

We do not sell personal data. We do not make decisions about you based solely on automated
processing that produce legal effects or similarly significantly affect you.

## 3. What happens if you do not give us data

Account and billing data are needed to provide the Service. Without them we cannot open an account
for you or sell you a paid Plan.

## 4. Where the data comes from

From you; from Google, if you sign in with Google; from the Merchant of Record, when you buy a paid
Plan; and from your browser, when you use our website and dashboard.

## 5. Who we share it with

**Service providers that process data for us**, under contracts that bind them to protect it:

| Provider | What for | Where | Safeguard for transfers |
|---|---|---|---|
| Appwrite [VERIFY: contracting entity, from the DPA in the Appwrite console] | Database, file storage, sign-in, backups | European Union — Frankfurt, Germany. Backups are kept in a separate region [VERIFY: backup region and retention on our Appwrite plan] | EU hosting [VERIFY: safeguard for any access from outside the EEA] |
| {{hosting.provider}} | Runs our website, the dashboard, and the endpoint that receives visitor measurement | {{hosting.region}} | [VERIFY: once the host is chosen] |
| Resend [VERIFY: contracting entity] | Sending service emails | United States | EU Standard Contractual Clauses and the EU-US Data Privacy Framework |
| Geoapify GmbH [REMOVE IF UNUSED] | Placing addresses you import on the map, and calculating routes you draw | Germany and Finland | European Economic Area |
| Cloudflare, Inc. | Storing and delivering published map files | Global network; United States company | EU Standard Contractual Clauses and the EU-US Data Privacy Framework |

**Independent controllers**, whose own privacy policies apply:

- **Google** — if you choose "Continue with Google".
- **{{billing.merchantOfRecord}}** — sells paid Plans and processes payments.
- **OpenFreeMap** (Hyperknot Software Kft., Hungary) — serves the map tiles your browser downloads to
  draw a map, both in our dashboard and on Published Maps. Each request necessarily carries your IP
  address. Its privacy policy states that it does not log IP addresses, except temporarily when
  investigating an attack or misuse.

**Others:**

- professional advisers — lawyers, accountants and auditors — under a duty of confidentiality;
- courts, authorities and law enforcement, where the law requires it or where it is needed to
  protect our rights;
- a buyer, investor or successor in a merger, acquisition, financing, reorganisation or sale of all
  or part of our business, who may continue to use the data under this policy.

## 6. If you used a map on one of our customers' websites

- **The owner of that website is responsible** for data collected about how you used its map. Read
  their privacy notice and send requests to them. If you write to us instead, we will pass your
  request on to them.
- **The map sets no cookies and stores nothing in your browser.**
- To draw the map, your browser downloads the map file and photos from our providers, and map tiles
  from OpenFreeMap. Those requests carry your IP address, as every request on the internet does.
- **"Find nearest"** uses your location on your own device. Your position is not sent to us.
- **Only if the website owner has switched on visitor measurement**, we record the following on the
  owner's behalf, once per page view:
  - your IP address;
  - your approximate location — country, city and coordinates — where our hosting network derives
    them from your IP address (never GPS);
  - the website and page where the map was shown, and the page you came from;
  - whether you used a desktop, tablet or mobile device;
  - what you did in the map: that it loaded; which locations, shapes and groups of pins you opened;
    what you typed in its search box and how many results it found; which suggestion you picked;
    and whether you pressed directions, phone, email, website or "find nearest" — with timings.

  No identifier is stored on your device. Each page view gets a new random identifier that exists
  only inside that page.
- Individual records are kept for 30, 180 or 365 days, depending on the website owner's Plan.
  [VERIFY: automatic deletion by Plan is not implemented yet.] Daily statistics made from them —
  counts per location, search term, country, device, referring website and page, with positions
  rounded to about 11 km — contain no IP addresses, and are kept until the owner deletes the map or
  their account.
- **If your details appear in a customer's map** — for example as the named contact for a shop —
  that customer is responsible for them. Contact the customer; if you write to us, we pass it on.

## 7. Transfers outside the European Economic Area

We keep personal data in the European Economic Area wherever we can. Where a provider processes it
elsewhere, we rely on an adequacy decision of the European Commission — including the EU-US Data
Privacy Framework, for certified US companies — and on the European Commission's Standard
Contractual Clauses (Decision 2021/914), so that a safeguard remains even if an adequacy decision is
withdrawn. You can ask for a copy of the safeguards at {{contact.privacyEmail}}.

## 8. How long we keep data

The periods for each kind of data are in §2. When an account ends, you may ask for an export for 30
days; we then delete account data and Customer Content within the following 60 days, and backup copies
expire no later than 30 days after that (Terms of Service §13.7). The exceptions are accounting
records, which we keep for 10 years, and data needed for a legal claim, which we keep for as long as
the claim requires.

## 9. Your rights

You have the right to:

- **access** the personal data we hold about you, and receive a copy;
- **correct** it if it is wrong;
- **erase** it;
- **restrict** our processing of it;
- **receive** the data you gave us in a portable format, and have it sent to someone else;
- **object** to processing based on our legitimate interests — and to direct marketing at any time,
  in which case we stop;
- **withdraw consent** at any time, where we rely on consent, without affecting what we did before.

To use these rights, write to {{contact.privacyEmail}} from the email address on your account, or
tell us how to confirm who you are. We answer within one month. For complex or numerous requests we
may take up to two further months, and will tell you if we do. It is free, unless a request is
manifestly unfounded or excessive.

There is no button to delete your account yet. Write to us, and we delete it as set out in §8.

You also have the right to complain to a supervisory authority. In Lithuania that is the **State
Data Protection Inspectorate** (*Valstybinė duomenų apsaugos inspekcija*), L. Sapiegos g. 17, 10312
Vilnius, ada@ada.lt, [vdai.lrv.lt](https://vdai.lrv.lt). You may instead complain in the EU country
where you live or work. We would be grateful for the chance to put things right first.

## 10. Security

We protect personal data with measures including: encrypted connections (HTTPS); passwords stored
only as salted Argon2 hashes; sign-in cookies that scripts cannot read; administrative credentials
kept on servers only; access limited to people who need it; and a primary database hosted in the
European Union. No system is completely secure. If a breach puts your rights at risk, we will tell
you and the authorities as the law requires.

## 11. Children

{{name}} is a service for businesses. It is not directed at anyone under 18, and they may not create
an account. We do not knowingly collect their data.

## 12. Changes to this policy

We may update this policy. If we make a significant change, we tell account holders by email or in
the dashboard before it takes effect. The version and effective date are at the top of this page.
Earlier versions are available on request.

## 13. Contact

{{company.legalName}} · {{company.address}} · {{contact.privacyEmail}}
