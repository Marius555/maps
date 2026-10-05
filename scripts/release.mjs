/**
 * Cuts a release: version bump, CHANGELOG section, commit and tag.
 *
 *   npm run release -- patch            0.9.0 -> 0.9.1   fixes
 *   npm run release -- minor            0.9.1 -> 0.10.0  features
 *   npm run release -- major            0.10.0 -> 1.0.0  see below
 *   npm run release -- 0.9.0            an exact version (the first release)
 *
 * Steps, in order. It stops at the first one that fails:
 *  1. The tree must be clean and on `main`. `--allow-branch` skips the branch
 *     check, which is only for trying the script out on a scratch branch.
 *  2. `npm run check` and `npm run build:embed` must pass, the second because
 *     the embed's size budget is enforced only there (CLAUDE.md §4).
 *  3. The version moves in package.json and package-lock.json.
 *  4. A CHANGELOG.md section is written. Anything hand-written under
 *     "## Unreleased" goes first, then the commits since the last tag, grouped
 *     by conventional-commit type.
 *  5. The release is committed as `chore(release): vX.Y.Z` and tagged `vX.Y.Z`.
 *
 * **It never pushes.** Publishing a release is `git push --follow-tags`, typed
 * by a person. The commit and the tag are easy to undo locally and impossible
 * to undo once a deploy has run from them.
 *
 * What the numbers mean for this app (docs/notes/versioning.md):
 *  - **major**: something already published stops working without the customer
 *    doing anything. Inside one embed channel that must never happen. A change
 *    like that ships as a new channel instead (embed/channel.mjs).
 *  - **minor**: new features.
 *  - **patch**: fixes.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const SEMVER = /^\d+\.\d+\.\d+$/;
const KINDS = new Set(["patch", "minor", "major"]);

const args = process.argv.slice(2);
const kind = args.find((arg) => !arg.startsWith("--"));
const allowBranch = args.includes("--allow-branch");

const run = (command) =>
  execSync(command, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const runVisible = (command) => execSync(command, { cwd: ROOT, stdio: "inherit" });

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function main() {
  if (!kind || !(KINDS.has(kind) || SEMVER.test(kind))) {
    fail("say which release: patch, minor, major, or an exact version like 0.9.0.");
  }

  if (run("git status --porcelain")) {
    fail("the working tree has uncommitted changes. Commit or stash them first.");
  }

  const branch = run("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main" && !allowBranch) {
    fail(`releases are cut from main, and this is ${branch}.`);
  }

  const previousTag = lastTag();
  const commits = commitsSince(previousTag);

  if (commits.length === 0 && previousTag) {
    fail(`nothing has been committed since ${previousTag}.`);
  }

  console.log("release: running npm run check and npm run build:embed …");
  runVisible("npm run check");
  runVisible("npm run build:embed");

  // `npm version` keeps package-lock.json in step. Its own git commit and tag
  // are switched off, because the CHANGELOG has to be in the same commit.
  const version = run(`npm version ${kind} --no-git-tag-version`).replace(/^v/, "");
  const tag = `v${version}`;

  if (run(`git tag --list ${tag}`)) fail(`${tag} already exists.`);

  writeChangelog(version, commits);

  run("git add package.json package-lock.json CHANGELOG.md");
  run(`git commit -m "chore(release): ${tag}"`);
  run(`git tag -a ${tag} -m "${tag}"`);

  console.log(
    `\nrelease: ${tag} committed and tagged (${commits.length} commits since ` +
      `${previousTag || "the start"}).\n` +
      "  Review it:  git show --stat HEAD\n" +
      "  Publish it: git push --follow-tags\n" +
      "  Undo it:    git tag -d " + tag + " && git reset --hard HEAD~1",
  );
}

/** The newest `v*` tag reachable from HEAD, or "" before the first release. */
function lastTag() {
  try {
    return run('git describe --tags --abbrev=0 --match "v*"');
  } catch {
    return "";
  }
}

/** Subjects and bodies since `tag`, oldest first, without earlier release commits. */
function commitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  // A record separator between commits and a unit separator inside one, so a
  // body with newlines or "|" in it can't split a commit in two.
  const raw = run(`git log ${range} --reverse --format=%s%x1f%b%x1e`);

  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject, body = ""] = entry.split("\x1f");
      return { subject: subject.trim(), body };
    })
    .filter(({ subject }) => !subject.startsWith("chore(release):"));
}

const GROUPS = [
  ["breaking", "Breaking"],
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["perf", "Performance"],
  ["other", "Other"],
];

/** `feat(embed)!: x` → { type: "breaking", text: "**embed:** x" }. */
function classify({ subject, body }) {
  const match = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
  if (!match) return { type: "other", text: subject };

  const [, type, scope, bang, text] = match;
  const line = scope ? `**${scope}:** ${text}` : text;

  if (bang || /BREAKING CHANGE/.test(body)) return { type: "breaking", text: line };
  if (type === "feat" || type === "fix" || type === "perf") return { type, text: line };

  return { type: "other", text: line };
}

const HEADER = `# Changelog

Every release of the app and the embed, newest first. \`npm run release\` writes
each section. Notes written by hand under "## Unreleased" are carried into the
next release above its commit list. Versioning rules: docs/notes/versioning.md.

## Unreleased
`;

function writeChangelog(version, commits) {
  const text = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8").replace(/\r\n/g, "\n") : HEADER;

  // The heading on a line of its own: the header's prose names it too.
  const unreleasedAt = text.search(/^## Unreleased[ \t]*$/m);
  if (unreleasedAt === -1) fail('CHANGELOG.md has no "## Unreleased" heading to release from.');

  const afterHeading = text.indexOf("\n", unreleasedAt) + 1;
  const nextSection = text.indexOf("\n## ", afterHeading);
  const end = nextSection === -1 ? text.length : nextSection + 1;
  const handWritten = text.slice(afterHeading, end).trim();

  const lines = [`## ${version} — ${new Date().toISOString().slice(0, 10)}`, ""];
  if (handWritten) lines.push(handWritten, "");

  const classified = commits.map(classify);

  for (const [type, title] of GROUPS) {
    const items = classified.filter((commit) => commit.type === type);
    if (items.length === 0) continue;

    lines.push(`### ${title}`, "", ...items.map((item) => `- ${item.text}`), "");
  }

  const section = lines.join("\n");
  const next = `${text.slice(0, afterHeading)}\n${section}\n${text.slice(end)}`;

  writeFileSync(CHANGELOG, `${next.trimEnd()}\n`);
}

try {
  main();
} catch (error) {
  // A failed check has already printed its own output. The version may have
  // moved by now, so say how to put it back.
  console.error(`\nrelease: stopped. ${error.message.split("\n")[0]}`);
  console.error(
    "  If package.json changed: git checkout package.json package-lock.json CHANGELOG.md",
  );
  process.exit(1);
}
