# Settings — design notes

`app/(dashboard)/settings/**`, `components/user-settings/**`, `lib/theme/**`,
`lib/account-deletion/**`, `lib/auth/sessions.ts`, `app/api/account/{profile,password,sessions,invoices,deletion}/**`.

The person's settings, modelled on claude.ai's: a left column of sections
(General, Account, Billing, Usage) and the section beside it. It
replaced `/account`, which is now a redirect to `/settings/billing`, and the
theme submenu in the account menu.

**No visible heading, full width.** The "Settings" `<h1>` is `sr-only`
(`PageTitle`), like every other dashboard page — the person pressed Settings to
get here and the nav says which section. The layout is the default full-width
`Container`, left-aligned, with the column capped at `max-w-6xl`; it was a
centred `max-w-5xl` holding a `max-w-3xl` column, which squeezed Billing's plan
columns. Forms that should stay narrow cap themselves (`sm:max-w-md`,
`sm:max-w-xl`).

## Invariants

- **Nothing on these pages moves when it is touched.** `.steady` on the
  settings layout root switches off HeroUI's press scale and keeps a pending
  button at its width (`app/globals.css`). **A dialog portals out of that root**,
  so every `Modal.Backdrop` opened from settings carries `className="steady"`
  itself. Forget it and the dialog is the one place its buttons still shrink.
- **`scale: none` as well as `transform: none`.** The radio control is shrunk by
  Tailwind's `scale-95`, which writes the separate `scale` property.
  `transform: none` misses it.
- **Nothing arrives after the page to push it down.** Every read is made before
  render, and `loading.tsx` draws the real headings with skeletons sized to
  what replaces them. The one section whose height depends on the provider,
  Invoices, is last on its page. Save buttons are always rendered and disabled
  until the form is dirty. Errors are toasts, or the field's own description
  line (`description` on `FormTextField`), never an inserted alert.
- **"You are here" is a fill, never a weight.** A bolder nav label is a wider
  one, and in the phone's horizontal strip every item after it steps sideways.
- **The theme choice lives in localStorage under `heroui-theme` and nowhere
  else.** `lib/theme/theme-choice.ts` reads it afresh every time; nothing holds
  a copy. `ThemeSync` (always mounted) re-applies it when the OS flips while the
  choice is System, and when another tab writes it. The key's name is load
  bearing: the pre-paint script reads it before React exists.
- **The picker shows nothing selected until hydration.** `useThemeChoice` is
  null on the server, by design: the alternative is a guess that is wrong for
  half the visitors, and a hydration mismatch. The selection is a border colour
  on a border that is always there, so it arriving moves nothing.
- **Deletion order: cancel → files → rows → map → account rows → login.** The
  subscription is cancelled before anything is deleted, and a failure there
  stops everything. A location's files go before its row, because the row is
  the only record of which files are its. The login goes last, because after it
  nobody can sign in to finish. `lib/account-deletion/step.test.ts` holds all
  of it.
- **A deletion step refuses without a recent confirmation.** `POST
  /api/account/deletion` checks the typed address and stamps
  `prefs.deletionStartedAt`; `…/step` refuses without one less than a day old.
  Without it the step route would delete a whole account on a bare POST.
- **Invoices are listed by the subscription id on the caller's own row, and
  nothing else.** There is no parameter on `GET /api/account/invoices` that
  could name somebody else's.
- **Signed provider links are fetched per visit, never stored.** The portal
  and update-card URLs last 24 hours; an invoice PDF's link is signed but does
  not expire, which is the only reason it may be rendered into a table.

---

## What moved where

| Was | Is |
|---|---|
| `/account`, top half (usage meters) | Settings → Usage |
| `/account`, bottom half (plan columns) | Settings → Billing → Plans |
| `/account` header ("Renews…", Manage subscription) | Settings → Billing → Plan, Payment |
| Account menu → Appearance submenu | Settings → General → Appearance |
| Account menu → "Upgrade your account" / "Account and billing" | "Settings", plus "Upgrade plan" below Pro only |
| Map Settings → How the map looks | Removed. It was the editor toolbar's Palette popover drawn a second time |
| Map Settings → Filters, Extra fields | Locations → **Tags & fields** dialog |
| Map Settings → Map name | Map card menu → **Rename** |
| Map Settings → Delete map | Map card menu → Delete map (was already there) |
| Map Settings page itself | Deleted, with its sidebar item. One "Settings" in the app, the person's |

`/account` still exists as a redirect, carrying `?checkout=` through, because
the address is in bookmarks and old emails. `/checkout/done` replaces straight
to `/settings/billing?checkout=done`. `proxy.ts` matches `/settings/:path*`.

## Why a theme store, and not HeroUI's `useTheme`

The account menu held the only always-mounted `useTheme`, and that made it,
invisibly, the thing that followed a live OS light/dark switch while the
choice was System. Moving the picker to a page that is not always mounted
would have taken that away from every other page. `useTheme` also keeps the
choice in `useState`, one copy per caller, read at mount. `ThemeSync`'s old
docblock recorded the bug that caused once already, and a server-rendered
picker calling it would hydrate against a value the server never had.

So there is no copy. Storage is the value, a same-tab event and the
`storage` event say it changed, and `ThemeSync` re-reads on either, and on
`matchMedia` change.

## The no-shift rules, measured

HeroUI v3 shrinks these on press, hard-coded, with no variable:

| Class | Scale |
|---|---|
| `.button` | 0.97 (sm 0.98, lg 0.96) |
| `.menu-item`, `.list-box-item` | 0.98 |
| `.close-button` | 0.93 |
| `.pagination__link`, `.toggle-button` | 0.96–0.98 |
| `.dropdown__trigger`, `.modal__trigger`, `.alert-dialog__trigger`, `.drawer__trigger` | 0.97 |
| `.radio__control` | Tailwind `scale-95` (the `scale` property) |

`data-reduce-motion` does not stop any of them. It removes the transition and
leaves the shrink. HeroUI's own `button-group.css` answers it with `transform:
none`, and `.steady` does the same, unlayered so it beats `@layer components`
whatever the specificity. The radio's dot also grows from 6px to 8px under a
press; `.steady` pins it at the selected size and leaves the unselected dot
alone, because that dot's `scale` is the selection animation itself.

**The pending spinner used to widen its button.** The global rule appends a
ring after the label, which is right everywhere else and wrong in a row whose
Save sits on the right edge: pressing it moved its own left edge. Under
`.steady` the label is kept but painted transparent (`-webkit-text-fill-color`,
so `currentColor`, which the ring is drawn in, survives), children are
`visibility: hidden` so their space is kept, and the ring is centred
absolutely. Same box, ring in place of the words.

## Billing: what changed about the merchant of record

The old account page's docblock said the card, invoices and cancelling all
"belong to the merchant of record", and linked out for them. They still
belong to it. It issues, numbers, taxes and stores every invoice, holds the
card and the billing address, and cancelling is one call to its own cancel.
What changed is that a customer no longer has to know a portal on another site
exists:

- **Invoices** are listed from `/subscription-invoices` and each row links the
  provider's own PDF. Nothing about an invoice is stored here. Invoices from an
  earlier, ended subscription are not listed (the row holds only the current
  subscription's id), and the section says the portal has them.
- **Cancel and resume** are in the app. Cancel is `DELETE /subscriptions/{id}`,
  which keeps the plan to the end of the paid period; resume is `PATCH
  cancelled: false`. Both replies go through `toState` into the row, like
  every other write to it.
- **The card and billing address stay the provider's pages**, opened in a new
  tab: `urls.update_payment_method` and `urls.customer_portal`.

**`cancelled` is read live, and that fixed a bug.** The row stores a cancelled
subscription as `active`, correctly for what it grants, so the old header
printed "Renews" on a subscription that was not going to. `subscriptionDetails`
asks the provider on every Billing visit (one GET that also carries the card
and both links), and the page says "Ends" instead. While cancelled, the plan
columns offer nothing but Resume, and the PATCH route refuses a plan change
with the same message, because moving a subscription that is about to end
bills a change nobody will use.

## Account deletion, in steps

A Pro account can be fifteen maps of three thousand locations with photos, and
a photo is one storage request to delete. Appwrite Sites cuts a request off at
30 seconds, so the dialog calls `POST /api/account/deletion/step` until it says
`done`. Each call does about 15 seconds of work and re-reads what is left, so a
step that dies (timeout, closed tab) leaves nothing the next one cannot find.
The dialog retries a failed step three times, then offers Try again, which
carries on without confirming again.

`deleteMap` does not remove a map's groups or its analytics rows
(`mapSessions`, `mapDaily`), and single-map deletion still leaves them. That
is a known gap, not fixed here. Account deletion removes them explicitly
(`deleteEmptiedMap`).

**Known leftover:** a webhook that arrives after the account is gone, such as
the provider's `subscription_expired` at the end of the cancelled period,
carries our user id in `custom_data`, and the webhook will upsert a
`subscriptions` row for a user that no longer exists. It holds billing ids and
nothing personal, and nothing reads it. Guarding the webhook against it is a
small follow-up if it matters.

## Password and devices

- **Only an account with a password sees the Password section**, and it always
  asks for the current one. An account made by Google sign-in has an empty
  `passwordUpdate` (`accountHasPassword`) and gets no section; the route
  refuses it with a 403 as well, because Appwrite would accept a first password
  with no old one — a stolen session could add a password and outlive its own
  revocation. There is no "Set a password" any more.
- Password changes run as the user (session client), so Appwrite itself checks
  `oldPassword`. Afterwards every other session is signed out; this one stays.
  Throttled to five tries in fifteen minutes.
- The device list comes from the session client's `listSessions`. It is
  readable because every session this app creates forwards the browser's user
  agent. Signing out this device is Log out, not a row button, because that
  also clears the cookie.
- Signing devices out and deleting the account are open to an unconfirmed
  account (`allowUnverified`). Everything else here is behind the email gate
  like every other write.

## Not built

- **Change email.** It needs the current password, a new confirmation link,
  and a frozen account until it is clicked, and a Google-only account cannot
  use it. claude.ai does not offer it either.
