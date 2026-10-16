/**
 * Build the site here and deploy the finished build to Appwrite Sites.
 *
 *   npm run deploy:site                 # build, package, upload, activate
 *   npm run deploy:site -- --no-upload  # build and package only; prints the size
 *   npm run deploy:site -- --no-build   # package what .next already holds
 *
 * Run by `.github/workflows/deploy.yml`, not by hand: it refuses to upload from
 * anywhere but Linux with musl, for the reason below. `docs/notes/deploy.md`.
 *
 * ## Why the build does not happen on Appwrite
 *
 * A cold `next build` of this app peaks at ~2.6GB in one process, and the site's
 * build box (2GB, and not raisable on the Free plan) kills the job: "Job was
 * killed because it ran out of memory". So the build runs where memory is cheap
 * and Appwrite is handed the result.
 *
 * ## Why Appwrite accepts a finished build
 *
 * Appwrite Sites runs open-runtimes' Next.js helpers. After the build command,
 * `helpers/next-js/bundle.sh` looks for `.next/standalone/server.js` and, when
 * it is there, moves `.next/standalone/*`, `.next/static` and `public/` into the
 * runtime folder; `server.sh` then starts `node server.js`. So the package is
 * those three folders laid out as in the repo, and the deployment's install and
 * build commands are no-ops. Appwrite's box only moves files.
 *
 * ## Why Linux with musl
 *
 * The runtime image is `node:<v>-alpine`. `next/image` runs `sharp`, a native
 * module, and standalone tracing copies whichever `sharp` binary npm installed —
 * glibc's or Windows' would ship, load nowhere, and break every image only in
 * production. The workflow builds in a `node:<v>-alpine` container for that.
 *
 * ## The environment the build sees
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so the build has to see the
 * site's production values. They are read from the site's own variables — one
 * place to set them, the Appwrite console — and handed to `npm run build` in its
 * environment. Nothing is written to disk. A variable stored as *secret* reads
 * back empty: that is an error for a `NEXT_PUBLIC_*` one (the browser would get
 * an empty value) and a warning for anything else, which the server still reads
 * at runtime.
 *
 * ## Environment (deploy credentials — never on the site)
 *
 * - `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
 * - `APPWRITE_API_KEY` — with `sites.read` and `sites.write`
 * - `APPWRITE_SITE_ID` — optional when the project has exactly one site
 * - `BUILD_COMMIT` — optional; the workflow passes the pushed commit
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { AppwriteException, Client, Sites } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const DEPLOY_WAIT_MS = 15 * 60_000;
const OUTPUT_DIRECTORY = "./.next";

/** Public files the deployed site must not carry; gitignored, so absent in CI anyway. */
const PUBLIC_EXCLUDED = new Set(["tiles"]);

const args = new Set(process.argv.slice(2));
const build = !args.has("--no-build");
const upload = !args.has("--no-upload");

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  fail(`Missing environment variables: ${missing.join(", ")}`);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const sites = new Sites(client);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function explain(error) {
  if (error instanceof AppwriteException && error.type === "general_unauthorized_scope") {
    return `${error.message} Give the deploy key the sites.read and sites.write scopes in the console, then run this again.`;
  }
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------------ *
 * Preflight
 * ------------------------------------------------------------------ */

/** True on Linux with musl: Node reports no glibc version there. */
function isMusl() {
  return process.platform === "linux" && !process.report.getReport().header.glibcVersionRuntime;
}

async function resolveSite() {
  const configured = process.env.APPWRITE_SITE_ID?.trim();
  if (configured) return sites.get({ siteId: configured });

  const { sites: all } = await sites.list();
  if (all.length === 1) return all[0];

  fail(`The project has ${all.length} sites; set APPWRITE_SITE_ID to say which one to deploy.`);
}

/** The build must run on the Node major the site runs, or traced native modules may not load. */
function checkNodeVersion(site) {
  const wanted = /^node-(\d+)/.exec(site.buildRuntime)?.[1];
  const running = process.versions.node.split(".")[0];

  if (wanted && wanted !== running) {
    fail(
      `The site runs ${site.buildRuntime} but this is Node ${process.versions.node}. Build on Node ${wanted} (the workflow's container image) so native modules match.`,
    );
  }
}

/**
 * The site must be `ssr`, or Appwrite serves `.next` as static files and every
 * page, API route and the proxy are gone. Every other setting is passed back
 * as it is: an update resets whatever it is not given.
 */
async function ensureSsr(site) {
  if (site.adapter === "ssr") return;

  await sites.update({
    siteId: site.$id,
    name: site.name,
    framework: site.framework,
    enabled: site.enabled,
    logging: site.logging,
    timeout: site.timeout,
    installCommand: site.installCommand,
    buildCommand: site.buildCommand,
    startCommand: site.startCommand,
    outputDirectory: site.outputDirectory,
    buildRuntime: site.buildRuntime,
    adapter: "ssr",
    fallbackFile: site.fallbackFile,
    installationId: site.installationId,
    providerRepositoryId: site.providerRepositoryId,
    providerBranch: site.providerBranch,
    providerSilentMode: site.providerSilentMode,
    providerRootDirectory: site.providerRootDirectory,
    providerBranches: site.providerBranches,
    providerPaths: site.providerPaths,
    buildSpecification: site.buildSpecification,
    runtimeSpecification: site.runtimeSpecification,
    deploymentRetention: site.deploymentRetention,
    scopes: site.scopes,
  });
  console.log(`  update  site adapter ${site.adapter} -> ssr`);
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

/** The site's variables, as the build's environment. */
async function siteEnvironment(siteId) {
  const { variables } = await sites.listVariables({ siteId });
  const env = {};
  const unreadable = [];

  for (const { key, value, secret } of variables) {
    if (secret && !value) unreadable.push(key);
    else env[key] = value;
  }

  const publicUnreadable = unreadable.filter((key) => key.startsWith("NEXT_PUBLIC_"));
  if (publicUnreadable.length > 0) {
    fail(
      `${publicUnreadable.join(", ")} ${publicUnreadable.length === 1 ? "is" : "are"} stored as secret on the site, so the build cannot read ${publicUnreadable.length === 1 ? "it" : "them"} — and the browser would get an empty value. Recreate as non-secret: a NEXT_PUBLIC_ value is public by definition.`,
    );
  }
  if (unreadable.length > 0) {
    console.warn(`  note    secret, so absent at build (the server still reads them): ${unreadable.join(", ")}`);
  }

  console.log(`  read    ${variables.length - unreadable.length} site variables for the build`);
  return env;
}

function runBuild(siteEnv) {
  const result = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...siteEnv,
      NODE_ENV: "production",
      BUILD_STANDALONE: "true",
      SKIP_BUILD_TYPECHECK: "true",
    },
  });

  if (result.status !== 0) fail(`npm run build exited with ${result.status ?? result.signal}.`);
}

/* ------------------------------------------------------------------ *
 * Package
 * ------------------------------------------------------------------ */

/**
 * `.next/standalone`, `.next/static` and `public`, laid out as in the repo —
 * which is what bundle.sh moves into place. Next copies `.env*` into
 * standalone; those are dropped, so no secret travels in the upload.
 */
function assemble() {
  if (!statSync(".next/standalone/server.js", { throwIfNoEntry: false })) {
    fail("No .next/standalone/server.js. Build with BUILD_STANDALONE=true (or drop --no-build).");
  }

  const root = mkdtempSync(join(tmpdir(), "pinglide-site-"));
  const stage = join(root, "site");

  cpSync(".next/standalone", join(stage, ".next/standalone"), {
    recursive: true,
    filter: (source) =>
      !(basename(source).startsWith(".env") && statSync(source).isFile()),
  });
  cpSync(".next/static", join(stage, ".next/static"), { recursive: true });

  for (const name of readdirSync("public")) {
    if (PUBLIC_EXCLUDED.has(name)) continue;
    cpSync(join("public", name), join(stage, "public", name), { recursive: true });
  }

  // Relative paths only, run from inside the folder: GNU tar reads the colon in
  // an absolute Windows path as a remote host.
  const archive = join(root, "site.tar.gz");
  const tar = spawnSync("tar", ["-czf", "../site.tar.gz", "."], { cwd: stage, stdio: "inherit" });
  if (tar.status !== 0) fail(`tar exited with ${tar.status ?? tar.signal}.`);

  const size = statSync(archive).size;
  console.log(`  pack    ${(size / 1024 / 1024).toFixed(1)}MB -> ${archive}`);

  return { root, archive };
}

/* ------------------------------------------------------------------ *
 * Upload
 * ------------------------------------------------------------------ */

async function waitForDeployment(siteId, deploymentId) {
  const deadline = Date.now() + DEPLOY_WAIT_MS;
  let last = "";

  while (Date.now() < deadline) {
    const deployment = await sites.getDeployment({ siteId, deploymentId });

    if (deployment.status !== last) {
      console.log(`  status  ${deployment.status}`);
      last = deployment.status;
    }
    if (deployment.status === "ready") return deployment;
    if (deployment.status === "failed" || deployment.status === "canceled") {
      fail(
        `Deployment ${deploymentId} ${deployment.status}.\n${(deployment.buildLogs ?? "").slice(-1500)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  fail(`Deployment ${deploymentId} was not ready after ${DEPLOY_WAIT_MS / 60_000} minutes.`);
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function main() {
  if (upload && !isMusl()) {
    fail(
      "Refusing to upload: this is not Linux with musl, so the build carries the wrong native sharp and images would fail in production. Deploy through .github/workflows/deploy.yml, or pass --no-upload to build and package only.",
    );
  }

  const site = await resolveSite();
  console.log(`Site ${site.name} (${site.$id}), ${site.buildRuntime}`);
  if (upload) checkNodeVersion(site);

  if (build) runBuild(await siteEnvironment(site.$id));

  const { root, archive } = assemble();

  try {
    if (!upload) return;

    await ensureSsr(site);

    const deployment = await sites.createDeployment({
      siteId: site.$id,
      code: InputFile.fromPath(archive, "site.tar.gz"),
      installCommand: "echo prebuilt",
      buildCommand: "echo prebuilt",
      outputDirectory: OUTPUT_DIRECTORY,
      activate: true,
    });
    console.log(`  upload  deployment ${deployment.$id}`);

    await waitForDeployment(site.$id, deployment.$id);
    console.log("Deployed and activated.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => fail(explain(error)));
