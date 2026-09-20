/**
 * Idempotent Cloudflare provisioner for published snapshots.
 *
 *   npm run setup:r2
 *
 * Makes the R2 bucket servable to strangers' websites, which is five settings and
 * every one of them is load bearing:
 *
 * 1. **Custom domain** (`SNAPSHOT_PUBLIC_URL`'s host) on the bucket. Never the
 *    `pub-*.r2.dev` URL: Cloudflare rate-limits it and it is not cached — see
 *    docs/self-hosting-tiles.md. Attaching the domain creates its DNS record.
 * 2. **r2.dev stays off**, so there is exactly one public address to reason about.
 * 3. **Bucket CORS**: GET and HEAD from any origin. The embed `fetch`es the
 *    snapshot from a customer's page, and that is a CORS request.
 * 4. **A cache rule** on the host. Cloudflare does not cache `.json` by default,
 *    so without this every visitor's fetch is a paid R2 read — a metered request
 *    in the visitor path (CLAUDE.md §2). Edge and browser TTLs respect the
 *    object's own Cache-Control, which lib/snapshot/r2-store.ts sets per object.
 * 5. **A response-header rule** setting `Access-Control-Allow-Origin: *` on the
 *    host. Belt and braces over 3, for one specific trap: R2 only adds CORS
 *    headers when the request carries an Origin, so a request *without* one (a
 *    crawler, curl, a prefetch) can fill the edge cache with a copy that has none,
 *    and every browser then fails CORS on that URL until it expires. "set", not
 *    "add", so the header is never doubled — a doubled ACAO fails CORS too.
 *
 * Uses CLOUDFLARE_API_TOKEN, which the app itself never reads and which never goes
 * onto the deployed site. Safe to re-run: a second run prints only `ok`.
 *
 * If the token lacks a permission the step says so and prints where the same
 * setting lives in the dashboard, rather than half-configuring in silence.
 */

const REQUIRED_ENV = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "SNAPSHOT_PUBLIC_URL"];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Add them to .env, then run npm run setup:r2 again.");
  process.exit(1);
}

const API = "https://api.cloudflare.com/client/v4";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const BUCKET = process.env.R2_SNAPSHOT_BUCKET || "snapshots";
const HOST = new URL(process.env.SNAPSHOT_PUBLIC_URL).host;
const BUCKET_PATH = `/accounts/${ACCOUNT}/r2/buckets/${BUCKET}`;
const HOST_EXPRESSION = `(http.host eq "${HOST}")`;

const CORS_RULES = [
  {
    allowed: { origins: ["*"], methods: ["GET", "HEAD"] },
    maxAgeSeconds: 86400,
  },
];

/** Upserted by `ref`, so a re-run replaces ours and leaves anyone else's alone. */
const ZONE_RULES = [
  {
    phase: "http_request_cache_settings",
    what: "cache rule",
    dashboard: "Caching → Cache Rules",
    rule: {
      ref: "snapshots_cdn_cache",
      description: `Cache published snapshots on ${HOST} (npm run setup:r2)`,
      expression: HOST_EXPRESSION,
      action: "set_cache_settings",
      action_parameters: {
        cache: true,
        edge_ttl: { mode: "respect_origin" },
        browser_ttl: { mode: "respect_origin" },
      },
      enabled: true,
    },
  },
  {
    phase: "http_response_headers_transform",
    what: "CORS header rule",
    dashboard: "Rules → Transform Rules → Modify Response Header",
    rule: {
      ref: "snapshots_cdn_cors",
      description: `Access-Control-Allow-Origin * on ${HOST} (npm run setup:r2)`,
      expression: HOST_EXPRESSION,
      action: "rewrite",
      action_parameters: {
        headers: {
          "Access-Control-Allow-Origin": { operation: "set", value: "*" },
        },
      },
      enabled: true,
    },
  },
];

/** Fields a rule may be written back with; the rest are read-only. */
const RULE_FIELDS = [
  "id",
  "ref",
  "description",
  "expression",
  "action",
  "action_parameters",
  "enabled",
  "logging",
];

let failed = 0;

console.log(`Configuring R2 bucket "${BUCKET}" behind https://${HOST}`);
console.log("");

const zone = await findZone(HOST);

// The bucket-level steps do not need the zone, so a token that cannot see it
// still gets them done — and the report says exactly which half is missing.
if (zone) await customDomain(zone);
await managedDomainOff();
await bucketCors();

if (zone) {
  for (const entry of ZONE_RULES) await zoneRule(zone, entry);
  await probe();
} else {
  failed += 1;
  console.error(`  FAIL    no zone serving ${HOST} is visible to this token, so the custom`);
  console.error("          domain, cache rule and CORS header rule were skipped. Give the token");
  console.error("          Zone → Zone: Read, with that zone under Zone Resources.");
}

console.log("");
console.log(failed > 0 ? `${failed} step(s) need attention.` : "Done.");
process.exit(failed > 0 ? 1 : 0);

// ---------------------------------------------------------------------------

async function customDomain(zone) {
  const list = await cf("GET", `${BUCKET_PATH}/domains/custom`);
  if (!list.ok) return fail("custom domain", list, "R2 → bucket → Settings → Custom Domains");

  const existing = list.result.domains?.find((domain) => domain.domain === HOST);

  if (!existing) {
    const created = await cf("POST", `${BUCKET_PATH}/domains/custom`, {
      domain: HOST,
      zoneId: zone.id,
      enabled: true,
      minTLS: "1.2",
    });
    if (!created.ok) {
      return fail("custom domain", created, "R2 → bucket → Settings → Custom Domains");
    }
    console.log(`  create  custom domain ${HOST}`);
  } else if (!existing.enabled) {
    const enabled = await cf("PUT", `${BUCKET_PATH}/domains/custom/${HOST}`, {
      enabled: true,
      minTLS: "1.2",
    });
    if (!enabled.ok) {
      return fail("custom domain", enabled, "R2 → bucket → Settings → Custom Domains");
    }
    console.log(`  enable  custom domain ${HOST}`);
  }

  // Ownership and certificate are issued asynchronously; usually under a minute.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await cf("GET", `${BUCKET_PATH}/domains/custom/${HOST}`);
    const status = current.result?.status ?? {};

    if (status.ownership === "active" && status.ssl === "active") {
      console.log(`  ok      custom domain ${HOST} (ownership and TLS active)`);
      return;
    }
    if (attempt === 0) {
      console.log(`  wait    ${HOST}: ownership ${status.ownership}, TLS ${status.ssl}…`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  failed += 1;
  console.error(`  PENDING custom domain ${HOST} is not active yet — re-run in a few minutes.`);
}

async function managedDomainOff() {
  const current = await cf("GET", `${BUCKET_PATH}/domains/managed`);
  if (!current.ok) return fail("r2.dev access", current, "R2 → bucket → Settings → Public Development URL");

  if (!current.result.enabled) {
    console.log("  ok      r2.dev URL disabled");
    return;
  }

  const disabled = await cf("PUT", `${BUCKET_PATH}/domains/managed`, { enabled: false });
  if (!disabled.ok) return fail("r2.dev access", disabled, "R2 → bucket → Settings → Public Development URL");
  console.log("  update  r2.dev URL disabled");
}

async function bucketCors() {
  const current = await cf("GET", `${BUCKET_PATH}/cors`);

  if (current.ok && sameJson(current.result?.rules, CORS_RULES)) {
    console.log("  ok      bucket CORS: GET, HEAD from any origin");
    return;
  }

  const written = await cf("PUT", `${BUCKET_PATH}/cors`, { rules: CORS_RULES });
  if (!written.ok) return fail("bucket CORS", written, "R2 → bucket → Settings → CORS Policy");
  console.log("  update  bucket CORS: GET, HEAD from any origin");
}

async function zoneRule(zone, { phase, what, dashboard, rule }) {
  const path = `/zones/${zone.id}/rulesets/phases/${phase}/entrypoint`;
  const current = await cf("GET", path);

  // 404 is "this zone has no rules in that phase yet", which PUT creates.
  if (!current.ok && current.status !== 404) return fail(what, current, dashboard);

  const rules = (current.ok ? current.result.rules ?? [] : []).map(writable);
  const index = rules.findIndex((existing) => existing.ref === rule.ref);

  if (index >= 0 && sameRule(rules[index], rule)) {
    console.log(`  ok      ${what} on ${HOST}`);
    return;
  }

  if (index >= 0) rules[index] = { ...rule, id: rules[index].id };
  else rules.push(rule);

  const written = await cf("PUT", path, { rules });
  if (!written.ok) return fail(what, written, dashboard);
  console.log(`  ${index >= 0 ? "update " : "create "} ${what} on ${HOST}`);
}

/**
 * What a customer's browser will see. There is no object at this path, so R2
 * answers 404 — and the CORS header must be on that answer too.
 */
async function probe() {
  try {
    const response = await fetch(`https://${HOST}/setup-r2-probe.json`, {
      headers: { Origin: "https://some-customer-shop.example" },
    });
    const acao = response.headers.get("access-control-allow-origin");

    if (acao === "*") {
      console.log(`  ok      https://${HOST} answers (HTTP ${response.status}) with ACAO *`);
    } else {
      failed += 1;
      console.error(
        `  FAIL    https://${HOST} answered HTTP ${response.status} without ` +
          "Access-Control-Allow-Origin. DNS may still be propagating — re-run shortly.",
      );
    }
  } catch (error) {
    failed += 1;
    console.error(`  FAIL    https://${HOST} is not reachable yet (${error.message}). Re-run shortly.`);
  }
}

async function findZone(host) {
  const labels = host.split(".");

  for (let start = 0; start < labels.length - 1; start += 1) {
    const name = labels.slice(start).join(".");
    const response = await cf("GET", `/zones?name=${encodeURIComponent(name)}`);
    if (response.ok && response.result.length > 0) return response.result[0];
  }

  return null;
}

/** The token goes in the header and nowhere else — never into a log line. */
async function cf(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));

  return {
    ok: response.ok && json.success !== false,
    status: response.status,
    result: json.result,
    errors: json.errors ?? [],
  };
}

function fail(what, response, dashboard) {
  failed += 1;
  const reason = response.errors.map((error) => `${error.code} ${error.message}`).join("; ");
  console.error(`  FAIL    ${what} — HTTP ${response.status}${reason ? `: ${reason}` : ""}`);
  if (response.status === 403 || response.errors.some((error) => error.code === 10000)) {
    console.error(`          The token cannot do this. Set it by hand: dashboard → ${dashboard}.`);
  }
}

function writable(rule) {
  return Object.fromEntries(
    RULE_FIELDS.filter((field) => field in rule).map((field) => [field, rule[field]]),
  );
}

function sameRule(existing, wanted) {
  return (
    existing.expression === wanted.expression &&
    existing.action === wanted.action &&
    existing.enabled === wanted.enabled &&
    existing.description === wanted.description &&
    sameJson(existing.action_parameters, wanted.action_parameters)
  );
}

/** Order-insensitive for object keys, so a re-serialised response still compares equal. */
function sameJson(a, b) {
  return canonical(a) === canonical(b);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
