/**
 * Writes public/embed/version.json, a small record of what the embed build is.
 *
 * It is uploaded beside map.js, at `embed/<channel>/version.json`, so
 * `curl https://cdn.pinglide.com/embed/v1/version.json` says which release
 * customers' sites are running, with no change to the bundle itself. That keeps
 * it out of the size budget (§4). It is the last step of `npm run build:embed`,
 * after the MapLibre copy, so the folder it names exists.
 *
 * `snapshotVersion` is the snapshot format this build reads. It is read from
 * `SUPPORTED_VERSION` in embed/src/snapshot.ts, so it cannot drift from it, and
 * the build fails if that constant ever stops being found.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { EMBED_CHANNEL, maplibreDir } from "../embed/channel.mjs";
import { buildInfo } from "./build-info.mjs";

const OUT_DIR = join(process.cwd(), "public", "embed");
const SNAPSHOT_SOURCE = join(process.cwd(), "embed", "src", "snapshot.ts");

async function main() {
  const require = createRequire(import.meta.url);
  const { version: maplibre } = JSON.parse(
    await readFile(require.resolve("maplibre-gl/package.json"), "utf8"),
  );

  const entries = await readdir(OUT_DIR);
  const chunk = entries.find((name) => /^map-[\w-]+\.js$/.test(name));

  if (!chunk || !entries.includes("map.js") || !entries.includes(maplibreDir(maplibre))) {
    console.error('write-embed-version: public/embed is incomplete. Run "npm run build:embed".');
    process.exit(1);
  }

  const match = /const SUPPORTED_VERSION = (\d+);/.exec(await readFile(SNAPSHOT_SOURCE, "utf8"));

  if (!match) {
    console.error("write-embed-version: SUPPORTED_VERSION not found in embed/src/snapshot.ts.");
    process.exit(1);
  }

  const { version, commit, builtAt } = buildInfo();
  const record = {
    channel: EMBED_CHANNEL,
    version,
    commit,
    builtAt,
    maplibre,
    snapshotVersion: Number(match[1]),
    chunk,
  };

  await writeFile(join(OUT_DIR, "version.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Wrote public/embed/version.json (${EMBED_CHANNEL} ${version} ${commit || "no commit"})`);
}

main().catch((error) => {
  console.error("Failed to write the embed's version.json.");
  console.error(error);
  process.exit(1);
});
