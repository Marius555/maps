# Auth — design notes

Everything between a stranger arriving at `/login` and a signed-in session
cookie: the split-screen screens, Google OAuth2, and the three transactional
emails.

## Invariants

- **The session is the httpOnly cookie our server sets, and there is only one of
  them.** `setSessionCookie` writes `a_session_<projectId>`; `proxy.ts`, the
  dashboard layout's `getCurrentUser()` and `requireUser()` in every `withAuth`
  handler all read it. Any flow that creates a session somewhere else — the
  Appwrite Web SDK's own storage above all — produces a user who is signed in on
  the client and signed out everywhere that decides anything.
- **`createOAuth2Token`, never `createOAuth2Session`.** The session variant asks
  Appwrite to set its own cookie on its own domain, which is precisely the
  invisible-session failure above.
- **`createOAuth2Token` is synchronous and navigates.** Typed `void | string`; it
  assigns `window.location.href`. Nothing may be scheduled after it and there is
  nothing to await.
- **The admin client is memoised and must never be mutated per request.**
  `setForwardedUserAgent` on it would attribute one visitor's session to
  another's browser. Forwarding belongs on `createSessionClient`, which is built
  fresh per call.
- **Every cross-site landing goes to a page outside `proxy.ts`'s matcher, never
  to a server redirect that ends at `/maps`.** See *The SameSite trap* below.
  This governs `/auth/success` and `/verify-email` and is the single most
  breakable thing in this area.
- **`proxy.ts` redirects towards `/login` and never away from it.** Bouncing a
  signed-in visitor off `/login` is `redirectIfSignedIn()`, called by the two
  pages that want it, because a proxy redirect answers a client-side navigation
  with a bare 307 and the router decodes the wrong route's payload. See *The
  proxy cannot redirect a navigation* below.
- **A token is single-use, so nothing that spends one may retry.**
  `useOAuthSession` and `useResetPassword` both set `retry: false`, and
  `OAuthCallback` guards its effect with a ref against StrictMode's double
  invocation. A retry cannot succeed and replaces an honest error with a
  confusing one.
- **Sending email may never fail a request.** Every caller is on the tail of
  something that already succeeded. `sendEmail` swallows its own failures and
  returns `{ sent: false }`; the signup route additionally wraps the token mint,
  which talks to Appwrite and can throw.
- **Forgot-password and resend-verification answer identically whether or not the
  address exists.** Both the response *and* the on-screen copy — a UI that says
  "check your inbox" puts back the membership oracle the route removed.
- **`env.appUrl` is configured, never read from the request.** A spoofed `Host`
  header would otherwise mint a working reset link pointing at an attacker's
  domain.
- **An address check that cannot decide must let the signup through.**
  `domainAcceptsMail` returns `true` on a timeout, a SERVFAIL, a refused
  connection and an error it does not recognise. Only two answers are decisive:
  the domain does not exist, or it has published nowhere to deliver. The
  alternative is a DNS wobble becoming a signup outage.
- **`lib/email/disposable-domains.generated.ts` is a megabyte and must never
  reach a browser.** `lib/email/disposable.ts` is its only reader and carries
  `server-only`; `signupSchema` stays free of it so the signup form can keep
  importing it, and `signupServerSchema` is the half that knows.
- **The confirmed-address gate lives in `withAuth` and nowhere else.** One check
  covers every authenticated route in the app, safe methods pass, and every route
  that must answer an unconfirmed account is `withoutAuth` already — so it needs
  no exemption list. A second hand-written copy of it anywhere is a bug.
- **Reads are never gated, and the gate is off entirely without a Resend key.**
  A frozen account still has to render the banner that explains the freeze, and a
  confirmation nobody can send would lock every account on the install forever.
- **Nothing that opens the gate may be behind it.** `POST /api/auth/verify-email`
  resends the link and takes an address rather than a session, precisely so it
  works for someone signed out. It is `withoutAuth` and must stay that way.
- **The auth back arrow is the browser's Back with a floor, and `?next=` means go
  home.** `AuthBackButton` (pinned to the form column by `app/(auth)/layout.tsx`)
  calls `router.back()` unless the history is one entry long (a fresh tab, an
  email link) or the URL carries `next` — which only `proxy.ts` writes, so the
  entry behind it is the protected page that bounced the visitor, and Back would
  only bounce them again. Both cases `router.push("/")`. `AuthShell` is centred
  under a lock badge; its `description` is optional, omitted on Log in and Sign
  up and kept wherever it carries instructions.

## The SameSite trap

The session cookie is `sameSite: "strict"`. Two links in this feature arrive from
somewhere that is not us — a mail client, and Appwrite's own domain after Google
— and browsers classify those as cross-site navigations *and carry that
classification through a server redirect chain*.

So the obvious implementation of both flows is wrong in the same way:

```
GET /api/auth/verify-email  ->  set cookie  ->  redirect /maps
                                                     |
                                 proxy.ts sees no cookie on this request
                                                     |
                                              redirect /login
```

A user who has just successfully confirmed their address, or just successfully
signed in with Google, lands on the login page. The cookie is fine — it is stored
and every subsequent same-site request carries it — so the bug is one bounce
long, intermittent-looking, and disappears the moment you reload.

Loosening the cookie to `lax` fixes it and was considered and rejected: this is a
security default, and the thing it buys is one redirect.

What both flows do instead is land on a page **outside the proxy's matcher**,
which therefore renders regardless of what cookie is visible, and navigate on
from there — because a navigation initiated by our own same-site page does carry
a Strict cookie.

- Verification: the route handler redirects to `/verify-email?status=ok`, which
  offers a `LinkButton` to `/maps`.
- OAuth: `/auth/success` is a client page. The exchange is a same-origin `fetch`
  (so the `Set-Cookie` lands) and the hop to `/maps` is `router.replace` (so the
  cookie goes with it).

This is also why `/auth/success`, `/auth/failure`, `/forgot-password`,
`/reset-password` and `/verify-email` never got a signed-in bounce of their own.
Giving them one would be worse than useless: it sends a signed-in user away, and
someone signed in on this browser is allowed to follow a reset link. It is the
reason `redirectIfSignedIn()` is called by `/login` and `/signup` individually
rather than from `(auth)/layout.tsx`, which would catch all seven.

## The proxy cannot redirect a navigation

`proxy.ts` used to hold the mirror of the signed-out rule — a session cookie on
`/login` or `/signup` redirected to `/maps`. It sent the right user to the right
place and it cost a full page reload every time, which is invisible on a desktop
and on a phone is a white flash and a second download of the whole app.

A client-side navigation does not request a page, it requests that route's flight
payload: `GET /login?_rsc=<hash>` with an `RSC: 1` header. A proxy redirect
answers that with a bare 307, `fetch` follows a 307 transparently and the router
is not allowed to intercept it, so what comes back is the payload for `/maps`
against a request made for `/login`. Decoding it walks onto a row id that has
already resolved and throws

```
TypeError: chunk.reason.enqueueModel is not a function
```

which surfaces as `Failed to fetch RSC payload for /login. Falling back to
browser navigation.` — the reload. The destination is never wrong, so the only
symptom is the reload and a console error, and it reproduces only while signed
in. Signed out, `/login` renders and nothing redirects.

**It cannot be fixed inside the proxy, and this was measured rather than
assumed.** Next strips both `_rsc` and the `RSC` header before `proxy()` is
called — instrumenting the function to echo `request.url` and
`request.headers.get("rsc")` back on the response returns a clean
`http://localhost:3000/login` and `null` for every form of the request. So the
proxy cannot tell a navigation from a document request, and cannot carry the
cache-busting param across the hop to keep the payload matched to the request.
Next's own client has a redirect-replay path for this
(`experimental.validateRSCRequestHeaders`, on by default) and it is what turns
the mismatch into the throw rather than a silent wrong render.

`redirect()` during a render is the mechanism that does work, because a redirect
raised while rendering is encoded *in the flight body* — the router applies it as
a redirect instead of decoding a foreign payload. On a document request it is
still a 307. Hence `redirectIfSignedIn()`.

Verified in the browser rather than by reasoning, per the house rule, and with
the control run both ways: clicking the marketing header's `Log in` while signed
in, holding a marker on `window` to tell a soft navigation from a reload. With
the proxy branch the marker is gone — the document was replaced. With
`redirectIfSignedIn()` the marker survives, the URL is `/maps`, and nothing is
logged.

The signed-out direction keeps its 307 and should. It answers a document request
— a typed URL, an old bookmark — and the one navigation that can reach it, a
session expiring with the dashboard open, is a case where a reload is the honest
outcome.

## Why Appwrite's tokens rather than our own

Every emailed link carries `userId` + `secret` from `admin.users.createToken`,
redeemed by `admin.account.createSession` — the same pair the Google flow uses.

The alternative was an HMAC signed with a new secret. That would have needed: a
signing key added to the environment and to every deployment, an expiry enforced
by hand, and somewhere to record that a token had been spent so it could not be
replayed. Appwrite's tokens are stored, expiring and single-use already, and cost
no schema change (CLAUDE.md §6).

The consequence to keep in view is that **redeeming a token creates a real
session**. That is not a side effect to be tidied away — it is the only way to
validate one — so every caller of `consumeToken` decides what happens to the
session it returns:

- `/api/auth/verify-email` keeps it and signs the user in. The token proved
  control of the address and the account is this browser's; asking for a password
  immediately after clicking "confirm" answers no question.
- `resetPasswordForUser` throws it away along with **every other session that
  user has**, before setting the new password. Someone resetting a password is
  often doing it because someone else has been in the account, and leaving that
  person's session alive makes the reset theatre. A fresh session is minted on
  the new password at the end.

TTLs differ by what the link is worth: 24 hours to confirm an address, one hour
to reset a password. A reset link is a standing offer to take over the account,
sitting in an inbox that — because anyone can type any address into
forgot-password — may not be the owner's.

## Known trade-off: link prefetching

`GET /api/auth/verify-email` spends the token. Corporate mail scanners and link
previewers follow URLs in email, so a scanned message can arrive already
"clicked", and the user then sees `status=expired` on their first real press.

The fix is an interstitial with a confirm button, which costs every user a click
to protect a minority. Left as is deliberately; the `expired` state carries a
resend form precisely so this is recoverable rather than terminal. Revisit if it
shows up in support.

## Google, and what is not code

Two console settings, and until both are done the flow lands on `/auth/failure`
with nothing in any log to say why — which is why that page names them.

1. **Auth → Social providers → Google** — enabled, with a Google Cloud OAuth
   client ID and secret. Those stay in the console; nothing about them belongs in
   this repo. Google Cloud's authorized redirect URI is
   `<endpoint>/account/sessions/oauth2/callback/google/<projectId>`.
2. **Settings → Platforms** — a Web platform for `localhost` and for the
   production hostname, or Appwrite rejects the redirect back.

Account linking is Appwrite's default behaviour: a Google identity whose address
matches an existing email/password account attaches to it. Nothing here builds
around that, and it is worth knowing before anyone reports it as a bug.

Google-created accounts arrive with `emailVerification: true`, so they skip the
confirmation email and get the welcome one straight away.

## An unconfirmed account is read-only

For most of this project's life `emailVerified` was plumbed from Appwrite to the
client and read by nothing, and then for a short while it gated publishing alone.
Both of those were argued from CLAUDE.md §13.4 — blocking a day-one signup behind
an inbox is friction that does not get a stranger closer to paying — and the
argument is still a real one. It is worth writing down that it was overridden
rather than forgotten.

**What changed is that the mail now arrives.** The publish-only gate was chosen
while `RESEND_FROM` was still `onboarding@resend.dev`, which delivers to the
Resend account owner and to nobody else. A gate whose key cannot be posted is a
lockout; a gate whose key lands in the inbox thirty seconds later is a step. With
a verified domain and a working key the owner asked for the wider one, and this
is it.

So: **`withAuth` refuses every non-GET request from an account that has not
confirmed its address.** Signing in, reading, and looking at what you already
built all stay open. Creating a map, importing a spreadsheet, moving a pin,
saving a design, geocoding, publishing — all 403 with `email_unverified`.

Three properties make that one check enough, and all three are load-bearing:

- **Every route that has to answer an unconfirmed account is `withoutAuth`
  already.** Signup, login, logout, both halves of verify-email, forgot and reset
  password, the OAuth exchange. They are unauthenticated because they run before
  or across a session, and the happy consequence is that the one way out of the
  gate can never accidentally end up inside it. No exemption list exists and none
  is needed.
- **Safe methods pass.** The banner that explains the freeze asks
  `GET /api/auth/me` for the address to name in it. Gate that and the product
  goes quiet instead of explaining itself.
- **The gate is inert when `RESEND_API_KEY` is unset.** `sendEmail` warns once and
  resolves `{ sent: false }` without a key, so a confirmation link would never be
  delivered and every account on that install would be permanently unusable. A
  clone with no `.env` has to boot — the same posture `lib/env.ts` takes for every
  optional value. `lib/auth/email-gate.ts` owns this.

`allowUnverified` on `withAuth` is the seam for the route that does not exist
yet. Self-service account deletion is the one that matters: somebody who mistyped
their address has no way to change it and no way to delete the account, so today
their only move is to sign up again with the right one. The flag is there so that
when the account page lands the answer is one opt-out rather than a hole.

**The gate is not inside `publishMap`, and never was.** `withAuth` has already
resolved a real Appwrite user, so `emailVerified` is a fact rather than a
cookie's claim — and `RepoContext` carries only a user id, by design (the session
secret never leaves `/lib/auth`). The repository's other caller is
`lib/sheet-sync/run.ts`, which republishes an already-live map from the daily
cron with no session at all. A check down that layer would either refuse every
nightly sync or make each one pay for an Appwrite lookup to re-answer a question
settled at signup. Nothing a customer has already published goes down when their
address lapses into unconfirmed, and that is deliberate.

### Saying it three times, on purpose

The rule at `lib/query/toast-error.ts` decides which channel carries what: *an
error about something that just happened is a toast; a message explaining why a
button is disabled stays beside the button.* The gate needs both, plus something
neither provides.

1. **The banner** (`components/verify-email/verify-email-banner.tsx`, mounted in
   `AppShell`) is the standing explanation and the button that fixes it. It is on
   every dashboard page because the server refuses *every* write, and greying
   every control that could provoke one would mean touching several dozen
   components and missing some.
2. **A `ControlNote` under the two controls that do grey** — Create map and
   Publish. They are doors rather than actions: everything else is reached
   through one of them. The note is built from `emailUnverifiedNote`, the same
   composer the 403's message starts with, so the greyed button and the refusal
   cannot describe the same state differently.
3. **One toast**, raised centrally from the `MutationCache` in
   `lib/query/client.ts`, for every write that was never disabled. Per-hook
   handling would cover the hooks somebody remembered; this covers the ones that
   do not exist yet. Without it, dragging a pin on a frozen account does nothing
   at all — which is exactly the grey-button-with-no-reason failure
   `lib/query/plan-limit-toast.ts` exists to record.

**`ErrorMessage` drops this one error on the floor, and that is the fourth
place.** Twenty-six components render a mutation's error inline, and the gate can
come back from any of them — so the toast above and an inline alert printed the
identical sentence twice, measured on the Settings tab by toggling a layer. The
filter lives in `components/ui/error-message.tsx` rather than at those
twenty-six call sites for the same reason the toast is central: there is one of
that file. Anything given its own global channel has to be silenced in the
inline one, or the two channels are not two channels.

Both client halves read `useMe()`, and **both disable only once it has answered**,
never while it is loading. The server owns the decision either way, so the costs
are asymmetric: a moment of a live button that fails honestly is nothing, and a
confirmed customer staring at a permanently dead Publish is a support ticket.

`useMe()` also carries `refetchOnWindowFocus: true` and `staleTime: 0`, against
the global defaults, and that is not a preference. The ordinary way out of this
gate is a link that opens in a **second tab**; the tab the user came from is the
frozen dashboard they return to. On the defaults it stays frozen until something
remounts, which reads exactly like the confirmation having failed. This file
claimed the refetch behaviour for months before it was true — it was inherited
from a version of the notice that predated `makeQueryClient` turning focus
refetching off globally. Check it in a browser, not here.

Verified with the control run, which is the only version of that test worth
anything: on one synthetic focus event `/api/auth/me` refetched and the map
detail query on the same page did not. Two traps if you repeat it — TanStack v5
binds `visibilitychange` on **`window`**, so an event dispatched on `document`
without `bubbles: true` never reaches it and reads as a failed refetch; and a
HeroUI toast is two nested nodes that both carry an alert role, so counting them
reports one toast as two.

Signup lands on `/verify-email?status=sent` rather than `/maps`, for the obvious
reason: the next useful action is in a mail client, not on a dashboard where
nothing saves. That branch is the only one of the four that can name the address,
because it is the only one whose visitor is signed in.

## The disposable check is friction, not a guarantee

`lib/email/disposable.ts` holds 75,000 domains, vendored by
`npm run build:disposable-domains` from two lists — one CC0 and hand-curated, one
MIT and regenerated daily. It is stale the day after it is generated, and the
services on it mint new domains faster than anyone re-runs a script.

So it is the same kind of thing as `lib/auth/throttle.ts` and the embed's domain
allowlist: it raises the cost of doing something we would rather people didn't,
and it does not pretend to make that thing impossible. Anyone determined can
register a domain. What this stops is the ten-second throwaway from the first
result for "temp mail", which is the case that actually happens.

`lib/email/mx.ts` is the half that does not go stale — it asks whether the domain
somebody just typed has a mail server *today*, which catches both the throwaway
registered this morning and the ordinary typo (`gmail.co`, `hotnail.com`) that
would otherwise become an account nobody can ever confirm. Its rule is in the
Invariants above and is the one thing here not to touch without argument: every
uncertain answer is a yes.

Both run in `signupServerSchema` rather than in `registerUser`. §6's "enforce in
the repositories" is about plan limits — quantities a client could otherwise talk
us out of; this is validation, and expressed as a Zod schema it inherits the
whole path that already exists: `parseBody` throws `ZodError`,
`toErrorResponse` turns it into a 422 carrying `fields.email`, and
`applyFieldErrors` renders the sentence under the Email field. No UI, no new
error code, no new envelope. The one mechanical requirement is that `parseBody`
calls `parseAsync` — a refinement that asks a resolver something cannot be
expressed synchronously.

**Neither check runs for Google sign-in**, which never reaches that route.
Appwrite creates the account during the OAuth exchange, so refusing one would
mean deleting a user we had just been handed — and a Google account is already an
address somebody proved they control.

Two escape hatches, and they are not the same. `EMAIL_DOMAIN_ALLOWLIST` un-blocks
a domain with no deploy, which is what you want when a real customer is locked
out at 2am. `KEEP` in `scripts/build-disposable-domains.mjs` is the durable one:
a name there survives the next regeneration, which the environment variable's
effect does not depend on but a colleague's memory does.

## The throttle is friction, not a guarantee

`lib/auth/throttle.ts` counts in this process's memory. A second instance has its
own counters and a restart forgets everything. It exists so one person holding
down a button cannot turn our Resend quota into someone else's inbox problem, and
for that it is enough. Keyed per address, because a global counter is a denial of
service against everyone else the moment one person trips it.

## The email templates hardcode their colours

`lib/email/templates/layout.ts` is the one file in the app allowed to name a
colour literally. Gmail strips `<style>`, no client resolves `var()`, and
`oklch()` is younger than most of the renderers this has to survive — so the
theme's values are converted to sRGB hex and inlined on every element. If the
accent changes in `globals.css`, this is the second place to change it.

Light only: `prefers-color-scheme` support across mail clients is too partial to
carry a second palette, and a light card is legible in a dark client while the
reverse is not.

## The left-hand panel is drawn, not photographed

There is not one image in `/public` — the 5,463 files under it are map tiles. A
photo would have meant sourcing, licensing and shipping an asset whose only job
is to be looked at once. `components/auth/auth-visual.tsx` is a few hundred bytes
of SVG that says what the product does.

Every colour in it is a theme token, so it crossfades with the page on a theme
change; a hardcoded palette would leave a light rectangle on a near-black page
for the length of every toggle. Both animations end where they start under
`prefers-reduced-motion` — the route's static state is the fully drawn line and
the halo's is a visible ring — because a reduced-motion machine collapses every
animation to a single 0.01ms pass, so anything told only in motion is told to
nobody.

Hidden below `lg` rather than stacked: on a phone it is decoration above the only
thing anyone came for, and it would push the first field under the fold.

## HeroUI notes specific to these screens

- **`FormPasswordField` is its own component, not a `showToggle` prop.** The
  anatomy genuinely differs — a suffix needs `InputGroup` wrapping
  `InputGroup.Input` — and one component rendering two anatomies off a boolean is
  worse than two components.
- **`type="button"` on the reveal toggle is load-bearing.** A `<button>` inside a
  `<form>` defaults to `type="submit"`, and React Aria does not set one for you.
  Without it, revealing your password submits the login form.
- **No Tooltip on a disabled Button.** React Aria puts a real `disabled`
  attribute on the element, so it takes no pointer events and the tooltip
  silently never fires. If a control needs to explain itself while unavailable,
  the explanation has to be in the DOM.
