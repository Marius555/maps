# Versioning — releases and the embed channel

Added 2026-10-05. Until then the app had no release identity: `package.json` said `0.1.0`
and nothing read it, and there were no tags and no changelog. The embed was served from
one unversioned URL, with MapLibre overwritten in place on every upgrade.

## Invariants

- **The embed channel only moves forward, and never changes what it means.** Customers
  paste `https://cdn.pinglide.com/embed/v1/map.js`, and every release inside `v1` reaches
  every one of those sites with no action from them. So a `v1` release must keep reading
  every snapshot `v1` was ever pointed at. A change that cannot do that starts `v2`
  (`EMBED_CHANNEL` in `embed/channel.mjs`), and `v1` stays deployed and frozen.
- **Never overwrite or delete a file a published `map.js` can import.** Two kinds of name
  are immutable: `map-[hash].js` (Vite hashes it), and anything under `maplibre-<version>/`
  (named after MapLibre's own version). A visitor can hold a cached `map.js` for up to
  five minutes, plus one stale-while-revalidate load. That old file still has to find
  exactly the chunk and the MapLibre it was built against. `upload-cdn.mjs` never deletes,
  and it uploads `map.js` last.
- **Only `map.js` and `version.json` keep their URL across releases.** They get the short
  `SCRIPT_CACHE`. Everything else under the channel is `immutable` for a year. Giving a
  mutable name a long TTL ships last week's embed to visitors for a year.
- **A release is cut from a clean `main` that passes `npm run check` and
  `npm run build:embed`.** `npm run release` enforces both, and never pushes.
- **The version is stamped at build time, never read at runtime.** `lib/version.ts` reads
  `NEXT_PUBLIC_APP_*`, which `next.config.ts` sets from `scripts/build-info.mjs`. Nothing
  reads `package.json` while the app is running.

## Releasing

```
npm run release -- patch      # fixes
npm run release -- minor      # features
npm run release -- major      # see "What the numbers mean"
npm run release -- 0.9.0      # an exact version: the first release only
git push --follow-tags        # publishing it is a separate, deliberate step
```

Before running it, write anything a reader needs to know under `## Unreleased` in
`CHANGELOG.md`. The script moves that text into the new section, above a list of the
commits since the last tag grouped by conventional-commit type. A subject that doesn't
follow the convention lands under "Other", so writing `feat:` and `fix:` is what makes
the changelog readable.

The first release is `0.9.0`, the baseline: everything built before versioning existed.
`1.0.0` goes with the first paying customer.

### What the numbers mean

- **major**: something already published stops working unless the customer acts. Inside
  one embed channel that must never happen. If it is unavoidable, it is a new channel and a
  major release together, and old snippets stay on the old channel.
- **minor**: features. Most releases.
- **patch**: fixes only.

## What is live

| Question | Answer |
|---|---|
| Which dashboard deploy is running? | `curl https://<site>/api/version`, or the foot of the admin rail |
| Which embed are customers' sites loading? | `curl https://cdn.pinglide.com/embed/v1/version.json` |
| What changed between two releases? | `CHANGELOG.md`, or `git log v0.9.0..v0.10.0` |

`version.json` names the release, commit, MapLibre version, hashed chunk and the snapshot
format that build reads (`SUPPORTED_VERSION` in `embed/src/snapshot.ts`, read from source
so it cannot drift). It lives beside the bundle rather than inside it, so it costs the
size budget nothing (§4).

**The commit is not yet confirmed on Appwrite Sites.** `build-info.mjs` reads
`APPWRITE_VCS_COMMIT_HASH`, then `BUILD_COMMIT`, then `git rev-parse`. If `/api/version`
shows an empty commit after a deploy, none of the three exists on the build machine: set
`BUILD_COMMIT` there, or find the variable Appwrite actually sets and put it first.

## Deploy order

1. The CDN gets the embed (`postbuild` with `UPLOAD_EMBED_ON_BUILD=true`, or
   `npm run deploy:cdn`). Within that upload, immutable files go first and `map.js` last.
2. Then the site goes live with the dashboard that writes snapshots.

The order matters the day the snapshot format changes. Today the embed rejects any
`version` other than `1` (`embed/src/snapshot.ts`), so an embed that can read a new
format has to be live **before** any dashboard writes one. Snapshot format versioning
itself is not built yet. It is the first item below.

## Not built yet

- **Snapshot format upgrades.** The embed accepting `1..N`, with a normalise step per old
  version, and a dashboard that only writes `N` once the CDN serves an embed that reads it.
- **Database migration tracking.** Today a migration script works out from the data
  whether it has already run, and nothing records which ones each environment has had.
  The fix would be numbered migrations, a table recording applied ones, and
  `npm run migrate --status`.
- **Contracts between separately deployed pieces.** The sheet-sync function calls cron
  routes with no contract version. The collect route accepts only beacon `v: 1`, so the day
  a `v: 2` exists it must accept both, because old embeds keep sending `1`.
