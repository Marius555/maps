# Notifications

Messages from us to account owners: product news, maintenance, a note about one
account. The sidebar's **Notifications** row carries an unread count; `/notifications`
lists them. They are written from the operator console's **Notifications** page
(`/admin/notifications`), which also lists what was sent and deletes it.

## Invariants

- **Admin client only; no row carries a permission.** Who sees a notification is decided
  by `listNotificationsFor`'s query (everyone / the account's plan / the account alone),
  never by Appwrite's ACL. No browser reads the table.
- **The link is checked twice**: `https://…` or an in-app `/path` on write
  (`isSafeNotificationLink`), and again in `toNotification`, which drops a link that fails
  or has no label rather than drawing it. `javascript:`, `data:`, `http:` and `//host` are
  refused.
- **The body is plain text** (`whitespace-pre-line`). No HTML, no markdown renderer.
- **Read state is one stamp, `notificationsSeenAt`, on the account's prefs** — merged,
  never written over (`updatePrefs` replaces the whole object; tutorial stamps and
  `deletionStartedAt` live there too). A broadcast stays one row however many accounts.
- **Unread = published after `max(notificationsSeenAt, registration)`.** A new account is
  not greeted with a count of every broadcast ever sent; older ones still list.
- **Opening the page is reading it.** The count clears; the items new at load stay marked
  "New" for the visit (`newIds`, taken from the server's feed), even after a refetch
  reports them read.
- **The mark-seen mutation cancels in-flight feed queries before zeroing the count.** On a
  cold load of `/notifications` the sidebar's own first fetch otherwise lands after it and
  puts the count back — measured, not hypothetical.
- **The count is fetched on the client, not in the dashboard layout**, so no page waits
  on it. Focus refetch plus a 10-minute interval; there is no push.
- A future `publishedAt` is a scheduled message; `expiresAt` past hides it. Both filtered at
  read, expiry in code (cheaper than an `or` with `isNull` for a handful of rows).
- **The console names one account by email, never by id.** `adminNotificationFormSchema`
  is what the form speaks; `POST /api/admin/notifications` resolves the address
  (`findUserIdByEmail`, a 422 on `audienceEmail` when nobody uses it) and then parses the
  result with `notificationInputSchema`, so the link and audience rules above still decide.
  The form's dates are `datetime-local` in the admin's own zone, sent as ISO.
- Account deletion removes the rows addressed to that account alone
  (`deleteNotificationsForUser`, from `deleteAccountRows`).

## Where things are

| | |
|---|---|
| Table | `notifications` in `scripts/appwrite-schema.mjs` |
| Repository | `lib/repositories/notifications.repository.ts` |
| Write schema | `lib/validation/notification.schema.ts` |
| Unread logic | `lib/notifications/unread.ts` (pure, tested) |
| Seen stamp | `lib/notifications/seen.ts` |
| Routes | `GET /api/notifications`, `POST /api/notifications/seen` (open to unconfirmed accounts) |
| Console | `app/admin/notifications/page.tsx`, `components/admin/sections/notifications/**`, `POST /api/admin/notifications`, `DELETE /api/admin/notifications/[id]`, `lib/admin/metrics/notifications.ts`, `lib/repositories/admin/notifications.ts` |
| Client | `lib/query/notifications.ts`, `components/notifications/**` |
| Chrome | `badge` on `NavItem` (count expanded, dot collapsed); dot on the mobile menu button |
