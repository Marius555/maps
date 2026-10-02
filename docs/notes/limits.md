# Limits — plan quantities, request rates, and who may write a row

Three different questions, answered in three places:

| Question | Where | Holds across instances? |
|---|---|---|
| How much may an account **keep or spend**? (maps, locations, shapes, lookups, sessions, features) | `lib/limits/plans.ts` | Yes — counted from stored rows |
| How **often** may somebody ask? (requests per minute) | `lib/limits/rate.ts` | No — per process, plus a Cloudflare rule |
| Who may **write** a row? | nobody but the admin client (`ownerPermissions` → `[]`) | Yes |

## Invariants

- **Every limit number is in `lib/limits/`.** `plans.ts` for quantities, `rate.ts` for
  request rates. `lib/repositories/plan-limits.ts` re-exports the plan tables, so old
  imports keep working. Nothing else should hard-code a limit.
- **Rows and files grant their owner nothing.** `ownerPermissions()` returns `[]`, and
  uploaded files carry only `read("any")` (`PUBLIC_FILE_PERMISSIONS`). The session cookie
  is the real Appwrite session secret, so any permission on a row is one its owner can use
  straight through Appwrite's REST API, past every check here. Before this, a user could
  PATCH their own `subscriptions` row to `pro`, move a place to another map, or point
  `photoIds` at somebody else's file and delete it through our photo route.
  `npm run migrate:permissions` strips older rows.
- **Every quantity check is "count, insert, recount".** `rollBackIfOverLimit` runs after
  the insert, and if the total is over the limit it deletes the rows *this call* made and
  refuses. Two racing requests may both be refused. The total can never end above the limit.
- **Every `withAuth` route is rate-limited by default** (`read` for GET, `write`
  otherwise, keyed by account). A route passes `{ rateLimit: "<policy>" }` only to be
  stricter. `withoutAuth` limits only when the route names an IP policy.
- **Rate counters are friction, not accounting.** They live in process memory. Anything
  that must be exact is counted from stored rows: the lookup allowance (`usage` table) and
  plan quantities (counted from the rows themselves).
- **Publish refuses a map over its owner's plan**, which can only happen after a downgrade.
  The live snapshot is never touched. A plan's map count keeps the *oldest* maps
  publishing (`isAmongFirstMaps`).
- **Lookups are recorded as they are spent**, every 5 (`lookupMeter`), so a request cut
  off at the host's 30-second cap has already billed nearly everything it spent. Bulk
  endpoints also hold an in-flight slot (`IN_FLIGHT_LIMITS`) so parallel batches cannot
  each pass the headroom check.

## How to change a limit

1. **A plan quantity or feature** (e.g. Free locations 25 → 30): edit `lib/limits/plans.ts`.
   Then run `npm run test`. `lib/marketing/plans.test.ts` fails and names the sentence on
   the pricing page (`lib/marketing/plans.ts`) that now promises something else. Update
   that, and CLAUDE.md §6's table.
2. **A request rate** (e.g. uploads 30 → 60 per 10 minutes): edit the line in
   `lib/limits/rate.ts`. Nothing else reads the number.
3. Deploy. Nothing is migrated: limits are read on every request, and a lowered limit only
   refuses *new* work. Existing rows stay, and a map now over its plan stops republishing.

## Checking one account

Admin console → Users. The Maps column shows `owned / allowed` and is red when over.
Click an account for `/admin/users/<id>`, which shows:

- the plan in force (`getUserPlan`, the function every check asks) beside the stored
  subscription row;
- maps and lookups this month against their limits;
- a table of every map: locations, shapes and this month's sessions against the plan,
  groups, sheet sync, and whether Publish would refuse it today.

## Rate limits and IP addresses

`clientIp()` reads `x-appwrite-client-ip`, then the first `x-forwarded-for` entry. The
second can be set by the client. That is accepted: spoofing it lets somebody **evade** a
per-IP counter but never **lock out** anybody else. The per-email and per-account counters
still hold.

**After any hosting change, check whether Appwrite overwrites a client-sent
`x-appwrite-client-ip`.** Send six signups with a bad body from one machine, rotating the
header value each time:

```
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code} " -H "x-appwrite-client-ip: 198.51.100.$i" \
    -H "content-type: application/json" -X POST -d '{}' https://<site>/api/auth/signup
done
```

`422 422 422 422 422 429` means the header is overwritten and per-IP limits hold. Six
422s means it is passed through: the in-app per-IP limits are evadable, and the Cloudflare
rule below is the one that counts.

## The Cloudflare rule (the layer that holds across instances)

The in-app counters are per process. A flood spread across instances, or across restarts,
needs an edge rule. This only works if the app's hostname is **proxied** (orange cloud) in
Cloudflare DNS. The `*.appwrite.network` origin stays reachable directly, which is why the
in-app layer exists as well.

Cloudflare dashboard → the zone → Security → WAF → Rate limiting rules → Create:

- **If incoming requests match:** `starts_with(http.request.uri.path, "/api/") and not
  starts_with(http.request.uri.path, "/api/webhooks/") and not
  starts_with(http.request.uri.path, "/api/cron/")`
- **With the same:** IP
- **When rate exceeds:** 100 requests per 10 seconds
- **Then:** Block, for 10 seconds

The free plan allows one rule with these periods. The webhook and cron paths are excluded
because Lemon Squeezy and the Appwrite Function each come from a few addresses and are
already authenticated by signature and secret.

Check it: `for i in $(seq 1 150); do curl -s -o /dev/null -w "%{http_code}\n" https://<site>/api/auth/me; done | sort | uniq -c`
should show Cloudflare's 429s after the first hundred.

## The permissions migration

```
npm run migrate:permissions -- --dry-run     # counts what would change
npm run migrate:permissions                  # rows → [], files → read("any") only
npm run migrate:permissions -- --verify-subscriptions        # compare every row to Lemon Squeezy
npm run migrate:permissions -- --verify-subscriptions --fix  # overwrite mismatches with the provider's answer
```

Run it once per environment, after deploying the code that stops granting the permissions.
In the other order, rows created in between would get them again. `--verify-subscriptions`
is how you learn whether anybody used the hole: a row whose plan, status or period end
disagrees with the provider, a paid plan with no provider id, or a kept plan that outlasts
its period.
