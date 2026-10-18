# Deploying the site

## Invariants

- **Appwrite never builds this app.** `.github/workflows/deploy.yml` builds it and
  `scripts/deploy-site.mjs` uploads the finished build. Reconnecting the repository to the site
  brings back the out-of-memory build on every push.
- **The build runs on Linux with musl, on the site's Node major.** It must never be uploaded from
  Windows or glibc. The script refuses both.
- **The site's adapter is `ssr`.** With `static`, Appwrite serves `.next` as files, and every
  page, API route and the proxy are gone. The script switches it once, passing every other
  setting back unchanged.
- **`NEXT_PUBLIC_*` site variables stay non-secret.** The build reads them from the site, and a
  secret variable reads back empty.
- **No `.env*` file travels in the upload.** Next copies them into `.next/standalone`, and the
  script drops them.
- **The package stays under Appwrite's ~30MB cap.** `deploy-site.mjs` fails before uploading
  past 30MB and lists the largest parts past 25MB. `sharp` is kept out on purpose
  (`images.unoptimized` and `outputFileTracingExcludes` in `next.config.ts`): turning the image
  optimiser back on puts ~8MB back, and that is a decision about the cap.

## Why the build moved off Appwrite

The first deployment failed at `next build` with "Job was killed because it ran out of memory".
The site's build spec is `s-2vcpu-2gb`, and changing it needs Pro.

Measured on 2026-10-17 on Windows, summing the working set of every Node process the build
started, with Turbopack's cache cleared to match Appwrite's "Build cache miss":

| Configuration | Peak |
|---|---|
| As it was | 3.4GB. Eleven prerender workers at ~170MB each, plus a TypeScript process. |
| `experimental.cpus: 1` and no in-build type check | 2.6GB |
| `TOKIO_WORKER_THREADS`, `RAYON_NUM_THREADS` and `TURBO_TASKS_AVAILABLE_PARALLELISM` set to 2 | 2.6GB, and three times slower |
| `turbopackPluginRuntimeStrategy: "workerThreads"` | Higher. PostCSS moves into the main process. |
| `next build --webpack` | 3.2GB, and the build fails on a `client-only` import |

What remains is Turbopack's compile: 2.2–2.5GB in one process, which no setting shrinks. So the
build went to GitHub Actions, which has 16GB, and `cpus: 1` was dropped again because it no
longer bought anything.

## How Appwrite takes a build it did not make

Appwrite Sites runs [open-runtimes](https://github.com/open-runtimes/open-runtimes)' Next.js
helpers (`runtimes/javascript/helpers/next-js/`):

- `bundle.sh` runs after the build command. If it finds `.next/standalone/server.js`, it moves
  `.next/standalone/*`, `.next/static` and `public/` into the runtime folder.
- `server.sh` then starts `node server.js`. Without a standalone build, it falls back to its own
  `next()` server over the full `node_modules`.

So the upload is those three folders, laid out as in the repo. The deployment's install and
build commands are `echo prebuilt`. Appwrite's guide warns against setting `output` in
`next.config`, but only because its own builder does the packaging. Its bundler handles
`standalone` explicitly. Hence `output` sits behind `BUILD_STANDALONE`: only the deploy build
sets it, so `next start` and local builds are unchanged.

## Why Alpine

The runtime image is `node:<v>-alpine` (open-runtimes `ci/runtimes.toml`), with `gcompat`.
Standalone tracing copies whatever native binary npm installed, so a build on glibc or Windows
ships one that does not load, and fails in production only. `sharp` was the module that forced
this. It is no longer in the package (see the size cap above), but the rule stays for the next
native module. The workflow therefore builds in `node:22-alpine`, matching the site's
`buildRuntime` of `node-22`. If the site's runtime changes, change the container to match; the
script refuses a mismatch. The lockfile already carries the musl binaries for `sharp`, SWC,
Tailwind's oxide, lightningcss and rolldown.

## The package size cap

The 2026-10-18 deploy failed at upload, not at build: `pack 33.3MB`, then "The deployment file
size is either not valid or exceeds the maximum allowed size". Appwrite Cloud refuses a Sites
deployment over about 30MB. That figure comes from user reports, not documentation, and
`_APP_COMPUTE_SIZE_LIMIT`, which the message names, is a self-hosting variable Cloud does not
expose.

Where the 33MB went, measured from a standalone build and gzipped:

| Part | Size |
|---|---|
| `.next/server` | 6.2MB |
| `public/docs` (the new screenshots, JPEG) | 4.9MB |
| `next` | 3.8MB |
| `.next/static` | 3.7MB |
| `public/map-themes` | 1.8MB |
| everything else | ~3MB |
| `sharp` with its musl libvips | ~8MB |

The last row only shows up in a Linux build: Windows ships libvips inside a package tracing does
not follow.

Next's standalone tracing copies `sharp` and `@img/sharp-libvips-*` into every build not hosted
on Vercel (`next/dist/build/collect-build-traces.js`). Nothing here used it: the docs figures
were the only `next/image` caller and were already `unoptimized`, and the OG image is `next/og`.
So `sharp` is excluded. The screenshots became WebP at the same pixel size, half the bytes.
Together those take about 10MB off.

## The build's environment

The build needs the site's production `NEXT_PUBLIC_*` values, because they are inlined into the
client bundle. It also needs the server's keys for the pages prerendered at build time. Both are
read from the site's variables (`sites.listVariables`) and passed to `npm run build` as its
environment. Nothing is written to disk, and nothing is duplicated in GitHub. The repository
holds only four deploy secrets: endpoint, project id, site id, and a key with `sites.read` and
`sites.write`. Set a variable in the Appwrite console, and the next deploy builds with it.

The server still reads its variables at runtime from the same place.
`UPLOAD_EMBED_ON_BUILD=true` on the site makes `postbuild` upload the embed from the workflow,
as it was meant to from the host.

## Checking a deploy

- **The Actions run.** `npm run check` passes, the build lists its routes, and the script prints
  the package size, the deployment id and `ready`. The package must stay under ~30MB; past 25MB
  the script lists the largest parts.
- **The Appwrite deployment log.** It shows "Detected standalone Next.js build".
- **The live site.**
  - `/` renders.
  - `/login` works.
  - `/api/version` shows the pushed commit.
  - A docs page (`/docs/map-editor`) shows its screenshots. They are plain files, not optimised.

To check standalone completeness locally, without uploading:

- Run `npm run deploy:site -- --no-upload` with the deploy variables in the environment. It
  builds, packages, and prints the size.
- Alternatively, run `BUILD_STANDALONE=true npx next build`, copy `.next/static` and `public`
  beside `.next/standalone/server.js` as `bundle.sh` does, and run `node server.js` there.

The legal pages return 404 from any production build while their documents are drafts
(`components/legal/legal-page.tsx`), so a 404 there is not a packaging fault.
