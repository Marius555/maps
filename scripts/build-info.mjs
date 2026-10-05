/**
 * Records which release a build is and which commit it came from. Read at build
 * time by `next.config.ts`, for `lib/version.ts`, and by
 * `scripts/write-embed-version.mjs`, for the embed's version.json.
 *
 * Plain JS with no dependencies, so the Next config and the plain node scripts
 * can both import it. Everything here is read once, at build time.
 *
 * The commit is looked up in this order:
 *  1. `APPWRITE_VCS_COMMIT_HASH`, which Appwrite sets on a git-triggered deploy.
 *     **Not yet confirmed on our host.** If /api/version shows no commit after a
 *     deploy, that is why.
 *  2. `BUILD_COMMIT`, to set by hand on a host that provides neither of the
 *     others.
 *  3. `git rev-parse` in the working copy.
 *  4. `""`, which means unknown. A build never fails because git is missing.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function buildInfo(root = process.cwd()) {
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  return { version, commit: commitHash(root), builtAt: new Date().toISOString() };
}

function commitHash(root) {
  const fromEnv = process.env.APPWRITE_VCS_COMMIT_HASH || process.env.BUILD_COMMIT;
  if (fromEnv) return fromEnv.slice(0, 7);

  try {
    return execSync("git rev-parse --short=7 HEAD", {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}
