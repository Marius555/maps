/**
 * Point the `googleSheetsUpdate` Appwrite Function at the sheet sync, and deploy
 * `functions/sheet-sync` to it.
 *
 *   npm run setup:sheet-sync
 *
 * Idempotent, and safe to re-run after any change under `functions/sheet-sync`:
 * every run uploads the folder as a new deployment and activates it.
 *
 * ## What it sets
 *
 * - **The function's settings.** Schedule every 30 minutes; timeout 900s, the
 *   most a scheduled (asynchronous) execution may have and what `main.js`
 *   budgets against; **no execute access**, because the schedule needs none and
 *   anybody else triggering it would spend geocoding credit on demand; **no
 *   scopes**, because it never touches Appwrite — it calls our own route over
 *   HTTP, and an API key with every scope minted for each run is a key that can
 *   leak with nothing to show for it; no build command, because there are no
 *   dependencies.
 * - **`APP_URL` and `CRON_SECRET` on the function**, which is all `main.js` reads.
 * - **`CRON_SECRET` on the Site**, the same value, which the cron route compares
 *   against. Generated and written into `.env` first if `.env` has none. The
 *   site only reads it after its next deployment.
 *
 * ## Environment (setup only — none of these belong on the site)
 *
 * - `CRON_GOOGLE_GOOGLE_SHEETS_UPDATE` — the function's id. Required.
 * - `SHEET_SYNC_APP_URL` — the origin the function calls. Defaults to the Site's
 *   Appwrite domain. Never the local `APP_URL`, which is `localhost` in
 *   development and unreachable from Appwrite's cloud.
 * - `APPWRITE_SITE_ID` — which site gets `CRON_SECRET`. Optional when the
 *   project has exactly one site.
 *
 * The schedule is repeated in `lib/sheet-sync/schedule.ts`, which is what the UI
 * says. Change the two together.
 */

import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

import { AppwriteException, Client, Functions, Sites } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const SCHEDULE = "*/30 * * * *";
const TIMEOUT_SECONDS = 900;
const ENTRYPOINT = "src/main.js";
const SOURCE_DIR = "functions/sheet-sync";
const DEFAULT_APP_URL = "https://maps-5sbu.appwrite.network";
const DEPLOY_WAIT_MS = 5 * 60_000;

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "CRON_GOOGLE_GOOGLE_SHEETS_UPDATE",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Add them to .env, then run npm run setup:sheet-sync again.");
  process.exit(1);
}

const functionId = process.env.CRON_GOOGLE_GOOGLE_SHEETS_UPDATE.trim();
const appUrl = (process.env.SHEET_SYNC_APP_URL?.trim() || DEFAULT_APP_URL).replace(
  /\/+$/,
  "",
);

if (!/^https:\/\//.test(appUrl)) {
  console.error(`SHEET_SYNC_APP_URL must be an https origin; got ${appUrl}.`);
  process.exit(1);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const functions = new Functions(client);
const sites = new Sites(client);

/* ------------------------------------------------------------------ *
 * .env
 * ------------------------------------------------------------------ */

/**
 * `CRON_SECRET` from `.env`, or a new one written there. Appended rather than
 * rewritten in place, so the rest of the file is untouched.
 */
function cronSecret() {
  const existing = process.env.CRON_SECRET?.trim();
  if (existing) return existing;

  const secret = randomBytes(32).toString("base64url");
  const text = readFileSync(".env", "utf8");
  writeFileSync(
    ".env",
    `${text.replace(/\n*$/, "")}\n\n# Guards /api/cron/sheet-sync. The same value is on the site and the\n# googleSheetsUpdate function (npm run setup:sheet-sync).\nCRON_SECRET=${secret}\n`,
  );
  console.log("  wrote   CRON_SECRET to .env (new)");

  return secret;
}

/* ------------------------------------------------------------------ *
 * Variables, upserted by key
 * ------------------------------------------------------------------ */

async function upsertVariable(label, list, create, update, key, value) {
  const { variables } = await list();
  const current = variables.find((variable) => variable.key === key);

  if (!current) {
    await create(key, value);
    console.log(`  create  ${label} ${key}`);
  } else if (current.value !== value || !current.secret) {
    // A secret variable reads back with an empty value, so it is rewritten every
    // run: cheap, and the only way to be sure it holds what .env holds.
    await update(current.$id, key, value);
    console.log(`  update  ${label} ${key}`);
  } else {
    console.log(`  skip    ${label} ${key}`);
  }
}

const functionVariable = (key, value) =>
  upsertVariable(
    "function",
    () => functions.listVariables({ functionId }),
    (k, v) =>
      functions.createVariable({ functionId, variableId: "unique()", key: k, value: v, secret: true }),
    (variableId, k, v) =>
      functions.updateVariable({ functionId, variableId, key: k, value: v, secret: true }),
    key,
    value,
  );

const siteVariable = (siteId, key, value) =>
  upsertVariable(
    "site",
    () => sites.listVariables({ siteId }),
    (k, v) => sites.createVariable({ siteId, variableId: "unique()", key: k, value: v, secret: true }),
    (variableId, k, v) =>
      sites.updateVariable({ siteId, variableId, key: k, value: v, secret: true }),
    key,
    value,
  );

async function resolveSiteId() {
  const configured = process.env.APPWRITE_SITE_ID?.trim();
  if (configured) return configured;

  const { sites: all } = await sites.list();
  if (all.length === 1) return all[0].$id;

  console.error(
    `  The project has ${all.length} sites; set APPWRITE_SITE_ID to say which one gets CRON_SECRET.`,
  );
  return null;
}

/* ------------------------------------------------------------------ *
 * Packing the function: a .tar.gz in memory
 * ------------------------------------------------------------------ */

/**
 * A minimal ustar writer. Written out rather than shelling to `tar`, because on
 * Windows the `tar` first on the PATH may be GNU tar from Git, which reads the
 * colon in `C:\…` as a remote host — and the folder is two small files.
 */
function tarGz(dir) {
  const blocks = [];

  const walk = (path) => {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name);
      if (name === "node_modules") continue;
      if (statSync(full).isDirectory()) walk(full);
      else blocks.push(entry(relative(dir, full).split(sep).join("/"), readFileSync(full)));
    }
  };

  walk(dir);
  blocks.push(Buffer.alloc(1024));

  return gzipSync(Buffer.concat(blocks));
}

function entry(name, body) {
  if (Buffer.byteLength(name) > 100) throw new Error(`Path too long for tar: ${name}`);

  const header = Buffer.alloc(512);
  const octal = (value, length) => value.toString(8).padStart(length - 1, "0") + "\0";

  header.write(name, 0);
  header.write(octal(0o644, 8), 100);
  header.write(octal(0, 8), 108);
  header.write(octal(0, 8), 116);
  header.write(octal(body.length, 12), 124);
  header.write(octal(Math.floor(Date.now() / 1000), 12), 136);
  header.write("        ", 148);
  header.write("0", 156);
  header.write("ustar\0", 257);
  header.write("00", 263);

  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(octal(sum, 7) + " ", 148);

  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, padding]);
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

function explain(error) {
  if (error instanceof AppwriteException && error.type === "general_unauthorized_scope") {
    return `${error.message} Give APPWRITE_API_KEY the functions.read/functions.write and sites.read/sites.write scopes in the console, then run this again.`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function waitForBuild(deploymentId) {
  const deadline = Date.now() + DEPLOY_WAIT_MS;

  while (Date.now() < deadline) {
    const deployment = await functions.getDeployment({ functionId, deploymentId });

    if (deployment.status === "ready") return deployment;
    if (deployment.status === "failed" || deployment.status === "canceled") {
      throw new Error(
        `Deployment ${deploymentId} ${deployment.status}.\n${(deployment.buildLogs ?? "").slice(-1500)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Deployment ${deploymentId} was not ready after ${DEPLOY_WAIT_MS / 1000}s.`);
}

async function main() {
  console.log(`Function ${functionId} -> ${appUrl}/api/cron/sheet-sync`);

  const secret = cronSecret();
  const current = await functions.get({ functionId });

  await functions.update({
    functionId,
    name: current.name,
    runtime: current.runtime,
    execute: [],
    events: [],
    schedule: SCHEDULE,
    timeout: TIMEOUT_SECONDS,
    enabled: true,
    logging: true,
    entrypoint: ENTRYPOINT,
    commands: "",
    scopes: [],
  });
  console.log(
    `  update  function settings (schedule "${SCHEDULE}", timeout ${TIMEOUT_SECONDS}s, no execute access, no scopes)`,
  );

  await functionVariable("APP_URL", appUrl);
  await functionVariable("CRON_SECRET", secret);

  const siteId = await resolveSiteId();
  if (siteId) await siteVariable(siteId, "CRON_SECRET", secret);

  const code = InputFile.fromBuffer(tarGz(SOURCE_DIR), "code.tar.gz");
  const created = await functions.createDeployment({
    functionId,
    code,
    activate: true,
    entrypoint: ENTRYPOINT,
    commands: "",
  });
  console.log(`  deploy  ${SOURCE_DIR} as ${created.$id}, building…`);

  await waitForBuild(created.$id);
  console.log(`  ready   ${created.$id} (active)`);

  console.log(
    `\nDone. The function runs ${SCHEDULE} (UTC) against ${appUrl}.` +
      (siteId
        ? "\nRedeploy the site so it reads CRON_SECRET — until then the cron route answers 401."
        : "\nCRON_SECRET is not on any site yet — add it by hand, then redeploy the site."),
  );
}

main().catch((error) => {
  console.error(`\nsetup:sheet-sync failed: ${explain(error)}`);
  process.exit(1);
});
