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
`/reset-password` and `/verify-email` are deliberately *absent* from
`proxy.ts`'s matcher. Adding them to `AUTH_PATHS` would be worse than useless:
that set redirects signed-in users away, and someone signed in on this browser is
allowed to follow a reset link.

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

## Nothing gates on `emailVerified` yet

The field has been plumbed from Appwrite to the client since Week 1 and read by
nothing. It is now written by a real flow, and still read by nothing: no route
refuses an unverified user. That is a product decision rather than an oversight —
blocking a day-one signup behind an inbox is the friction CLAUDE.md §13.4 warns
about. The plumbing is here when the decision changes.

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
