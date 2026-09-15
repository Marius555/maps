# Cookie Policy

**{{name}}** · Version {{legal.version}} · Effective {{legal.effectiveDate}}

This policy explains the cookies and similar technologies — local storage, session storage and
IndexedDB — used on the {{name}} website and dashboard, operated by {{company.legalName}}. It also
explains what maps published with {{name}} do on our customers' websites.

## In short

- We use **one cookie you need to stay signed in**, and a few items that remember a choice you make
  or keep unsaved work safe.
- **No advertising, analytics or tracking cookies**, and we place no third-party cookies.
- **Maps published on our customers' websites set no cookies and store nothing** on their visitors'
  devices.

## 1. What these technologies are

A **cookie** is a small file a website stores in your browser and reads back later. **Local
storage**, **session storage** and **IndexedDB** are places in your browser where a website keeps
data on your device. Session storage is cleared when you close the tab; the others stay until they
expire or you clear them.

## 2. What we use

### Strictly necessary

Without these, the dashboard cannot work as you asked it to.

| Name | Type | What it does | When it is set | How long it lasts |
|---|---|---|---|---|
| `a_session_` followed by our project identifier | Cookie. First-party; `HttpOnly` (scripts cannot read it), `Secure`, `SameSite=Strict` | Keeps you signed in | When you sign in | Until you sign out or the session expires — at most 1 year |
| `lm-chunk-reloaded` | Session storage | If part of the dashboard fails to download just after we release an update, the page reloads itself once to recover. This flag stops it reloading in a loop | Only when that happens | Until you close the tab |
| `map-import` | IndexedDB | Keeps an import you are in the middle of on your device, so that a reload or a crash does not lose it. The locations are saved to your map only when you finish | When you start an import | Until you finish or cancel the import. An unfinished import older than 24 hours is thrown away instead of resumed |

### Preferences

These remember a choice you have just made about how the dashboard looks. Neither is set until you
make that choice, neither does anything else, and neither is sent to anyone else.

| Name | Type | What it does | When it is set | How long it lasts |
|---|---|---|---|---|
| `sidebar_collapsed` | Cookie. First-party; `SameSite=Lax` | Remembers whether you collapsed the dashboard's sidebar | Only when you collapse or expand the sidebar | 1 year |
| `heroui-theme` | Local storage | Remembers whether you chose light, dark or system appearance | Only when you choose an appearance | Until you clear your browser's data for our site |

## 3. Why we do not ask for consent

Lithuanian law (Article 61 of the Law on Electronic Communications, which implements the EU ePrivacy
Directive) does not require consent for storing information on your device where that is strictly
necessary to provide a service you have asked for. Everything above is either needed to run the
dashboard, or records a choice you have just made to change how the dashboard looks for you. That is
why there is no consent banner.

If we ever add anything that falls outside that — analytics, for example — we will ask first, and it
will not be set until you agree.

## 4. Third parties

- **Google.** If you choose "Continue with Google", you are taken to Google's sign-in page, where
  Google's own cookies and privacy policy apply.
- **{{billing.merchantOfRecord}}.** The checkout for paid Plans is provided by our Merchant of Record,
  which may set its own cookies under its own policy.
  [VERIFY: which cookies the checkout sets, once the Merchant of Record is chosen.]
- **OpenFreeMap.** The map tiles in the dashboard are downloaded from OpenFreeMap, which sets no
  cookies.

## 5. Maps published on our customers' websites

A map published with {{name}} and shown on a customer's website:

- sets **no cookies**;
- uses **no local storage, session storage or IndexedDB**;
- keeps **no identifier** beyond the page view it was created for.

If the website owner switches on visitor measurement, the map sends one report per visit using the
browser's beacon feature. Nothing is stored on the visitor's device to do this. The European Data
Protection Board (Guidelines 2/2023) considers that a script which causes a device to send
information can still need consent under the ePrivacy rules, even without a cookie. Whether that
website's visitors must be asked is for the website owner to decide, and is their responsibility
([Terms of Service]({{legal.termsUrl}}) §8). What the report contains is described in our
[Privacy Policy]({{legal.privacyUrl}}) §6.

## 6. How to control them

You can block or delete cookies and site data in your browser's settings. If you block the sign-in
cookie, you will not be able to sign in. If you delete the preference items, the dashboard goes back
to its default layout and appearance.

## 7. Changes and contact

We update this policy when what we store changes, and change the version and date at the top.
Questions: {{contact.privacyEmail}}.
