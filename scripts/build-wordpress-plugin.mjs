/**
 * Zips distribution/wordpress/pinglide into public/downloads/pinglide-wordpress.zip,
 * the file the Publish tab links to and the one uploaded to wordpress.org.
 *
 * Runs on `prebuild`, so every deploy serves the plugin as it is in the tree;
 * the zip itself is gitignored, like every other build output under public/.
 *
 * The archive's root is a `pinglide/` folder because that is what WordPress's
 * "Upload plugin" expects — a zip of loose files installs under a folder named
 * after the zip, and the plugin's slug would then be `pinglide-wordpress`.
 *
 * Fixed timestamps, so an unchanged plugin builds a byte-identical zip.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "distribution", "wordpress", "pinglide");
const outDir = join(root, "public", "downloads");
const outFile = join(outDir, "pinglide-wordpress.zip");

const EPOCH = new Date("2026-01-01T00:00:00Z");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = {};
for (const path of walk(source).sort()) {
  const name = `pinglide/${relative(source, path).split(sep).join("/")}`;
  files[name] = [readFileSync(path), { mtime: EPOCH }];
}

const header = readFileSync(join(source, "pinglide.php"), "utf8");
const version = /^\s*\*\s*Version:\s*(\S+)/m.exec(header)?.[1];
const stable = /^Stable tag:\s*(\S+)/m.exec(readFileSync(join(source, "readme.txt"), "utf8"))?.[1];

if (!version) throw new Error("pinglide.php has no Version: header.");
// wordpress.org installs the version readme.txt names, so the two drifting apart
// ships the wrong code to everybody — refuse rather than warn.
if (stable !== version) {
  throw new Error(`readme.txt's Stable tag (${stable}) differs from pinglide.php's Version (${version}).`);
}

mkdirSync(outDir, { recursive: true });
const zip = zipSync(files, { level: 9 });
writeFileSync(outFile, zip);

console.log(
  `WordPress plugin ${version}: ${Object.keys(files).length} files, ${(zip.length / 1024).toFixed(1)}KB -> ${relative(root, outFile)}`,
);
