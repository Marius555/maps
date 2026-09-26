/**
 * Puts the embed and the search gazetteer on the CDN host, beside the snapshots.
 *
 *   npm run deploy:cdn            everything built locally, gazetteer included
 *   node scripts/upload-cdn.mjs --on-build
 *                                 the `postbuild` hook: uploads only when the
 *                                 host sets UPLOAD_EMBED_ON_BUILD=true
 *
 * Why it exists: without it the snippet points at the dashboard's own origin
 * (`embedScriptUrl` in lib/embed/snippet.ts), so every visitor to every
 * customer's site downloads ~345KB of JavaScript from Appwrite Sites — metered
 * bandwidth in the visitor's path, which CLAUDE.md §2 forbids. And the URL in a
 * pasted snippet is permanent, so where it points has to be settled before the
 * first customer pastes one. R2 behind `cdn.pinglide.com` has no egress fee.
 *
 * Point the app at the result with
 *   NEXT_PUBLIC_EMBED_SCRIPT_URL=https://cdn.pinglide.com/embed/map.js
 *   NEXT_PUBLIC_GAZETTEER_URL=https://cdn.pinglide.com/gazetteer
 *
 * The gazetteer is gitignored and built by hand (`npm run build:gazetteer`), so a
 * build on the host never has it: its first upload, and any after a rebuild, is
 * this command run from a machine that does. The embed is rebuilt on every
 * deploy and uploaded by the hook.
 *
 * CORS is `npm run setup:r2`'s job and already covers the whole host: module
 * scripts and MapLibre's worker blob are CORS fetches, exactly like a snapshot.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { R2_ENV, r2Bucket } from "./r2.mjs";

const ROOT = process.cwd();
const EMBED_DIR = join(ROOT, "public", "embed");
const GAZETTEER_DIR = join(ROOT, "public", "gazetteer");
/** Vite's `publicDir` — the harness pages. Never uploaded; see check-embed-size.mjs. */
const HARNESS_DIR = join(ROOT, "embed", "dev");

/*
 * `map.js` is the one URL pasted into customers' pages, so its TTL is how long a
 * deploy takes to reach them; stale-while-revalidate keeps the edge answering
 * while it refetches. MapLibre's files change only with an upgrade. Gazetteer
 * shards change only when somebody rebuilds them.
 */
const SCRIPT_CACHE = "public, max-age=300, stale-while-revalidate=86400";
const VENDOR_CACHE = "public, max-age=86400";
const DATA_CACHE = "public, max-age=604800";

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const onBuild = process.argv.includes("--on-build");

if (onBuild && process.env.UPLOAD_EMBED_ON_BUILD !== "true") {
  // Every local `npm run build` lands here. Saying nothing would hide the fact
  // that the hook exists; saying more would be noise on every build.
  console.log("upload-cdn: UPLOAD_EMBED_ON_BUILD is not true, skipping.");
  process.exit(0);
}

const missing = R2_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`upload-cdn: missing ${missing.join(", ")}.`);
  process.exit(1);
}

async function main() {
  const bucket = r2Bucket();
  const harness = new Set(await readdir(HARNESS_DIR).catch(() => []));

  const embed = (await readdir(EMBED_DIR).catch(() => [])).filter(
    (name) => !name.endsWith(".map") && !harness.has(name) && typeOf(name),
  );

  if (!embed.includes("map.js")) {
    console.error('upload-cdn: no public/embed/map.js. Run "npm run build:embed" first.');
    process.exit(1);
  }

  const vendor = embed.filter((name) => name !== "map.js");
  // The gazetteer only exists on a machine that built it, and only a manual run
  // is expected to have it — the hook on the host never does.
  const gazetteer = onBuild ? [] : await walk(GAZETTEER_DIR);

  if (!onBuild && gazetteer.length === 0) {
    console.warn(
      "upload-cdn: no public/gazetteer — postcode search needs it. " +
        'Run "npm run build:gazetteer" and upload again.',
    );
  }

  const counts = { uploaded: 0, unchanged: 0 };

  /*
   * map.js last. It imports ./maplibre-gl.mjs by relative URL, so the files it
   * names must already be there when a visitor's browser first sees it.
   */
  for (const name of vendor) {
    await upload(bucket, `embed/${name}`, join(EMBED_DIR, name), VENDOR_CACHE, counts);
  }

  for (const file of gazetteer) {
    const key = `gazetteer/${relative(GAZETTEER_DIR, file).split(sep).join("/")}`;
    await upload(bucket, key, file, DATA_CACHE, counts);
  }

  await upload(bucket, "embed/map.js", join(EMBED_DIR, "map.js"), SCRIPT_CACHE, counts);

  console.log(
    `upload-cdn: ${counts.uploaded} uploaded, ${counts.unchanged} unchanged ` +
      `(${vendor.length + 1} embed, ${gazetteer.length} gazetteer).`,
  );
}

async function upload(bucket, key, file, cacheControl, counts) {
  const body = await readFile(file);
  const md5 = createHash("md5").update(body).digest("hex");

  if ((await bucket.etag(key)) === md5) {
    counts.unchanged += 1;
    return;
  }

  await bucket.put(key, body, { contentType: typeOf(file), cacheControl });
  counts.uploaded += 1;
  console.log(`  put  ${key}`);
}

function typeOf(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? undefined : TYPES[name.slice(dot)];
}

async function walk(dir) {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (typeOf(entry.name)) files.push(path);
  }

  return files.sort();
}

main().catch((error) => {
  // Messages from r2.mjs carry a status and an S3 code, never a credential.
  console.error(`upload-cdn: ${error.message}`);
  process.exit(1);
});
