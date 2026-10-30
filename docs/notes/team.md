# Team seats

More than one person working on one account's maps. The owner invites people by email
from **Settings → Team** as admin, editor or viewer; they accept from the link in the email
(`/invite/<token>`) or from **Invitations for you**, and switch between their own maps and
each team they belong to from the sidebar. Seats are included per plan — Free 1, Starter 3,
Pro 10 — and everyone with access holds one: the owner, every member, every pending invite.

This knowingly overrides CLAUDE.md §11, which listed "teams and permissions" as out of
scope for v1; §0 records the call.

Files: `lib/team/**`, `lib/repositories/{memberships,invites}.repository.ts`,
`lib/repositories/context.ts`, the `workspace` scopes in `lib/api/route.ts`,
`app/api/{team,invites,workspaces}/**`, `app/(auth)/invite/**`,
`app/(dashboard)/settings/team/**`, `components/team/**`,
`components/user-settings/team/**`, `components/layout/sidebar/workspace-switcher.tsx`,
`lib/limits/seat-slots.ts`, `lib/query/team.ts`, `e2e/team.spec.ts`.

## Invariants

- **A workspace is one person's account, and its id is that person's user id.** Every
  `userId` column that means "whose is this" — `maps`, `cardDesigns`, `subscriptions`,
  `usage`, `sheetLinks` — holds a workspace id. Every row ever written already held its
  founder's id, which is why teams needed **no data migration and no column rename**.
  Billing, the checkout, the webhook and the lookup allowance did not change at all: the
  owner's account *is* the team.
- **The owner is never a membership row.** `memberships` holds the other people;
  ownership is "the workspace id is your user id". There is no ownership transfer in v1 —
  it would have needed a workspace table, a cache and a way for account deletion to wipe
  the wrong team, for a case that (Free has one seat, paid plans were to block it) was
  reachable almost never.
- **`RepoContext` is `{ workspaceId, actorId, role }`, and `WorkspaceId` is branded.**
  `getUserPlan`, `assertPlanFeature`, the lookup meter, `holdsPublishSlot` and
  `getSubscription` take a `WorkspaceId`, which only `ownWorkspace`, `asWorkspaceId` and the
  resolvers make. That is what stopped `getUserPlan(user.id)` compiling on pages a member
  can open — the plan of a team's map is the team's, not the visitor's.
- **Every authenticated route names its scope** (`lib/api/route.ts`):
  - `withMapAuth` — every `/api/maps/[id]/**` route. The workspace is the map's owner
    (`resolveMapContext`), never the active-team cookie, so a tab on a team's map keeps
    working after another tab switched teams.
  - `withAuth` (active) — the maps list, creating a map, `/api/team/**`. The
    `pg_workspace` cookie names the team; it is a **hint**, checked against memberships on
    every request, and a value naming a team the person is not in falls back to their own.
  - `withPersonalAuth` — account, billing, notifications, accepting, leaving, switching.
  `lib/api/route-scopes.test.ts` holds every route to the right one by its folder.
- **`getMap` is still the whole access check.** It compares `map.userId` with
  `ctx.workspaceId`; a route resolved against the wrong workspace fails there with a 404,
  never opens. A map in a team you are not in is missing, not forbidden.
- **Membership is read fresh on every request and never cached past it**, and it is never
  part of `AuthUser` (cached 60 s per instance). Removing somebody takes effect on their
  next click. The owner pays nothing: a person in their own workspace is resolved with no
  read.
- **The viewer gate is in `withAuth`, beside the email gate**: a non-GET in a map or
  active scope from a viewer is a 403 `role_required`. Finer rules are `can`/`canManage`
  in the repositories — only an admin deletes a map, only the owner manages admins, nobody
  changes their own role. `lib/team/roles.ts` is the whole table; the buttons the dashboard
  hides read the same one.
- **No row grants anything** — both tables are created with `permissions: []`, like every
  other. Appwrite's `Role.team()` is deliberately unused: a row permission is usable
  straight through Appwrite's API with the session cookie.
- **Seats: inviting counts owner + members + live invites; accepting counts owner +
  members.** The invite being accepted already held its seat — counting it again refused
  the last invite into a team that was exactly full. Both are count, insert, recount.
- **After a downgrade nobody is removed.** The members who joined first keep their roles;
  the rest read as viewers until someone leaves (`lib/limits/seat-slots.ts`, the twin of
  `publish-slots.ts`). The Team page says so on their row.
- **Accepting needs a confirmed address that equals the invite's.** The accept routes are
  behind the email gate on purpose (no `allowUnverified`): holding the link is not proof,
  because the inviter was handed a copy for "Copy link", and anybody can sign up as an
  address they do not own. "Invitations for you" lists only for a confirmed address too.
- **Only the token's sha256 is stored.** The raw token exists in the email and in the one
  response that hands the inviter Copy link. Resend mints a new one and the old link dies.
- **Inviting never looks an address up.** Only ids already on the team are read
  (`readPeople`), so an invite cannot be used to learn who has an account.
- **The invite email's subject is fixed.** The names in it are typed by the inviter and
  the owner, not the recipient; they go in the escaped body, capped at 60 characters.
- **Invite links land outside `proxy.ts`'s matcher** (`app/(auth)/invite/[token]`), for
  the sameSite-strict reason in `auth.md`. The token is in the path because the proxy
  drops query strings, and `/invite/<token>` survives `?next=` through login and signup.
- **The token never reaches analytics**: `lib/posthog/redact.ts` cuts `/invite/<token>`
  and its encoded `next=` form out of every URL property, and the page sets
  `referrer: "no-referrer"`.
- **The card design moved to `/api/maps/[id]/card-design`.** It is the workspace's, but
  every page that edits it is a map's, and the map is what names the workspace.
- **Notifications and support follow the person** (`personalPlan`: the best plan among
  their own and every team they are in), so switching teams never changes the feed.
- **The sheet sync runs as the owner** (`systemContext(link.userId)`), so a member who
  linked the sheet and then left does not take the sync down with them.
- **Switching teams is a full document load** (`window.location.replace("/maps")`), which
  clears the router cache, react-query and the editor's zustand stores in one go.
- **Account deletion takes the team with it**: the owner's memberships and invites, and
  the person's own memberships elsewhere, in the account-rows stage. The dialog says how
  many people lose access before anything is deleted.

## How it was checked

`npm run check` covers the pure parts and the repositories against in-memory tables
(`lib/test/fake-tables.ts`): the role table, `canManage`, seat ranking, tokens, every invite
rule including the exactly-full accept and the parallel last-seat race, membership changes,
the resolver's fallbacks, the viewer gate, route scopes, the invite email and the PostHog
redaction. `e2e/team.spec.ts` walks the real flow with the two test accounts — invite by
the UI, join by the link, a viewer's refusals, promotion, map routes across a switch,
leaving, the invitation list, removal, a mismatched address and a revoked link. It is its
own Playwright project after `chromium`, because `api-security.spec.ts` needs the two
accounts to be strangers.
