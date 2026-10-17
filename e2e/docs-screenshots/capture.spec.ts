import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";

import { addPlaces, createMap, deleteMap, publishMap, updateMap, type TestMap } from "../support/api";
import { AUTH_FILE, E2E_PREFIX } from "../support/paths";
import { dismissTutorials } from "../support/tutorial";
import { DEMO_MAP_NAME, DEMO_PLACES, DEMO_SHAPES, DEMO_TAGS } from "./demo-map";

/**
 * The screenshots in /docs, taken from the running app rather than drawn.
 *
 *   npm run dev            # in another terminal, or let Playwright start it
 *   npm run docs:screenshots
 *
 * Not a test: it asserts only what it needs to know the screen is ready, and it
 * lives in its own Playwright project so `npm run e2e` never runs it. It seeds
 * one demo map (`./demo-map.ts`) on the E2E account, shoots every entry in
 * `SHOTS` once per theme, writes `public/docs/screenshots/<shot>-<theme>.jpg`,
 * regenerates `lib/docs/screenshots.generated.ts` and deletes the map.
 *
 * **Re-run it after changing any screen a guide shows** — a screenshot of a
 * control that has since moved is worse than none (docs/notes/marketing.md).
 *
 * Viewport shots, never `fullPage`: a full-page capture re-lays the page out and
 * blanks an idle MapLibre canvas. Before each shot `scrub` swaps the account's
 * email and name for placeholders and the dev origin for the production one.
 */

const OUT_DIR = path.resolve("public", "docs", "screenshots");
const MANIFEST = path.resolve("lib", "docs", "screenshots.generated.ts");
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 1.5;
const THEMES = ["light", "dark"] as const;
const PLACEHOLDER_EMAIL = "alex@fieldwork.coffee";
const PLACEHOLDER_NAME = "Alex Morgan";

type Shot = {
  name: string;
  /** Leaves the page showing what to shoot. A returned locator is shot alone. */
  open: (page: Page, map: TestMap) => Promise<Locator | void>;
};

/** Tiles and pins settle after the markers mount; there is no idle marker in the DOM. */
async function openEditor(page: Page, map: TestMap) {
  await page.goto(`/maps/${map.id}`);
  await expect(page.locator(".map-pin").first()).toBeVisible();
  await page.waitForTimeout(3000);
}

const SHOTS: Shot[] = [
  {
    name: "maps-list",
    open: async (page) => {
      await page.goto("/maps");
      await expect(page.getByText(DEMO_MAP_NAME).first()).toBeVisible();
      await page.waitForTimeout(1500);
    },
  },
  { name: "editor-overview", open: openEditor },
  {
    name: "editor-appearance",
    open: async (page, map) => {
      await openEditor(page, map);
      await page.getByRole("button", { name: "Map appearance" }).click();
      await expect(page.getByRole("dialog", { name: "Map appearance" })).toBeVisible();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "editor-draw-tools",
    open: async (page, map) => {
      await openEditor(page, map);
      await page.getByRole("button", { name: "Draw", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Choose a drawing tool" })).toBeVisible();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "edit-location",
    open: async (page, map) => {
      await openEditor(page, map);
      await page.getByRole("button", { name: "Actions for Fieldwork Covent Garden" }).click();
      await page.getByRole("menuitem", { name: "Edit" }).click();
      await expect(page.getByRole("dialog", { name: "Edit location" })).toBeVisible();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "locations-list",
    open: async (page, map) => {
      await page.goto(`/maps/${map.id}/places`);
      await expect(page.getByText("Fieldwork Covent Garden").first()).toBeVisible();
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "tags-manager",
    open: async (page, map) => {
      await page.goto(`/maps/${map.id}/places`);
      await page.getByRole("button", { name: "Tags & fields" }).click();
      await expect(page.getByRole("dialog", { name: "Tags & fields" })).toBeVisible();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "import-columns",
    open: async (page, map) => {
      await page.goto(`/maps/${map.id}/places/import`);
      await expect(page.getByRole("button", { name: "Choose file", exact: true })).toBeEnabled();
      await page.locator('input[type="file"]').setInputFiles({
        name: "new-stockists.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(IMPORT_CSV),
      });
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
      await page.waitForTimeout(1000);
    },
  },
  {
    name: "import-review",
    open: async (page) => {
      // Straight on from the columns step, which is still on screen.
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("button", { name: /^Import \d+ locations$/ })).toBeVisible();
      await page.waitForTimeout(3000);
    },
  },
  {
    name: "card-designer",
    open: async (page, map) => {
      await page.goto(`/maps/${map.id}/card`);
      await expect(page.getByRole("tab", { name: "Blocks" })).toBeVisible();
      await page.waitForTimeout(2500);
    },
  },
  {
    name: "publish-designer",
    open: async (page, map) => {
      await page.goto(`/maps/${map.id}/publish`);
      await expect(page.getByRole("button", { name: "Embed code and domains" })).toBeVisible();
      await page.waitForTimeout(4000);
    },
  },
  {
    name: "embed-code",
    open: async (page) => {
      await page.getByRole("button", { name: "Embed code and domains" }).click();
      await expect(page.getByRole("dialog").filter({ hasText: "Put this map on your site" })).toBeVisible();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "settings-general",
    open: async (page) => {
      await page.goto("/settings/general");
      await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();
      await page.waitForTimeout(1000);
    },
  },
  {
    name: "settings-billing",
    open: async (page) => {
      await page.goto("/settings/billing");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    },
  },
];

const IMPORT_CSV = [
  "Store name,Street,City,Postcode,Phone,lat,lng",
  "Leyton Larder,712 High Road,London,E10 6JP,+44 20 7946 0120,51.5652,-0.0115",
  "Crystal Palace Provisions,24 Westow Street,London,SE19 3AH,+44 20 7946 0121,51.4192,-0.0832",
  "Stoke Newington Store,150 Church Street,London,N16 0JU,+44 20 7946 0122,51.5622,-0.0806",
  "Ealing Kitchen,9 The Green,London,W5 5DA,+44 20 7946 0123,51.5099,-0.3045",
].join("\n");

test.describe.configure({ mode: "serial" });

test("capture the docs screenshots", async ({ browser }) => {
  test.skip(process.env.DOCS_SCREENSHOTS !== "1", "Run by name: npm run docs:screenshots");
  test.setTimeout(15 * 60_000);
  mkdirSync(OUT_DIR, { recursive: true });

  const seed = await browser.newContext({ storageState: AUTH_FILE, baseURL: test.info().project.use.baseURL });
  const map = await seedDemoMap(seed);
  const sizes: Record<string, { width: number; height: number }> = {};

  try {
    for (const theme of THEMES) {
      const page = await themedPage(browser, theme);
      const identity = await readIdentity(page);

      for (const shot of SHOTS) {
        await test.step(`${shot.name} (${theme})`, async () => {
          const target = await shot.open(page, map);
          await scrub(page, identity);
          const buffer = await (target ?? page).screenshot({ type: "jpeg", quality: 85 });
          writeFileSync(path.join(OUT_DIR, `${shot.name}-${theme}.jpg`), buffer);
          sizes[shot.name] = jpegSize(buffer);
        });
      }

      await page.context().close();
    }
  } finally {
    await deleteMap(seed.request, map.id);
    await seed.close();
  }

  writeManifest(sizes);
});

async function seedDemoMap(context: Awaited<ReturnType<Browser["newContext"]>>): Promise<TestMap> {
  const { request } = context;
  const map = await createMap(request, `${E2E_PREFIX}docs-demo-${Date.now()}`);

  // Fresh ids every run: an id is never derived from a label (CLAUDE.md).
  const ids = Object.fromEntries(DEMO_TAGS.map((tag) => [tag.id, crypto.randomUUID().slice(0, 12)]));
  await updateMap(request, map.id, {
    name: DEMO_MAP_NAME,
    defaultLat: 51.515,
    defaultLng: -0.12,
    defaultZoom: 10.6,
    tagGroups: [
      {
        id: crypto.randomUUID().slice(0, 12),
        label: "Type",
        tags: DEMO_TAGS.map((tag) => ({ id: ids[tag.id], label: tag.label, color: tag.color })),
      },
    ],
  });

  await addPlaces(
    request,
    map.id,
    DEMO_PLACES.map((place) => ({ ...place, tags: (place.tags ?? []).map((tag) => ids[tag]) })),
  );

  for (const shape of DEMO_SHAPES) {
    const response = await request.post(`/api/maps/${map.id}/shapes`, { data: shape });
    expect(response.status(), await response.text()).toBe(201);
  }

  await publishMap(request, map.id);
  return { ...map, name: DEMO_MAP_NAME };
}

/** The app's own theme store is localStorage `heroui-theme` (lib/theme/theme-choice.ts). */
async function themedPage(browser: Browser, theme: (typeof THEMES)[number]): Promise<Page> {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: test.info().project.use.baseURL,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: theme,
  });
  await context.addInitScript((value) => {
    try {
      localStorage.setItem("heroui-theme", value);
    } catch {}
  }, theme);
  const page = await context.newPage();
  await dismissTutorials(page);
  return page;
}

type Identity = { name: string };

async function readIdentity(page: Page): Promise<Identity> {
  await page.goto("/settings/general");
  const name = await page.getByRole("textbox", { name: "Name" }).inputValue();
  return { name };
}

/**
 * Makes the shot about the product, not the machine it was taken on:
 *
 * - any email address becomes the placeholder's;
 * - the account's name, **only where a text node or input is exactly the name**
 *   — a test account's name is often an ordinary word ("test"), and swapping it
 *   inside sentences rewrote "Open test page";
 * - the dev server's origin becomes the production one, so the embed snippet
 *   shows the URL a customer would actually paste;
 * - Next's dev-tools badge is hidden.
 */
async function scrub(page: Page, identity: Identity) {
  await page.evaluate(
    ({ identity, email, name }) => {
      const initials = name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
      const origin = location.origin;
      const swap = (text: string) => {
        const trimmed = text.trim();
        if (identity.name && trimmed === identity.name) return text.replace(trimmed, name);
        // The avatar's initials, which for this account are the name's first two letters.
        if (identity.name && trimmed === identity.name.slice(0, 2).toUpperCase()) {
          return text.replace(trimmed, initials);
        }
        return text
          .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, email)
          .split(`${origin}/embed/map.js`)
          .join("https://cdn.pinglide.com/embed/v1/map.js")
          .split(origin)
          .join("https://pinglide.com");
      };

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const next = swap(node.nodeValue ?? "");
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      for (const input of document.querySelectorAll<HTMLInputElement>("input")) {
        const next = swap(input.value);
        if (next !== input.value) input.value = next;
      }
      for (const portal of document.querySelectorAll<HTMLElement>("nextjs-portal")) {
        portal.style.display = "none";
      }
    },
    { identity, email: PLACEHOLDER_EMAIL, name: PLACEHOLDER_NAME },
  );
}

/** Width and height from a baseline or progressive JPEG's SOF segment. */
function jpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buffer.length) {
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc2) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("Not a JPEG Playwright would write: no SOF segment.");
}

function writeManifest(sizes: Record<string, { width: number; height: number }>) {
  const names = Object.keys(sizes).sort();
  const body = names
    .map((name) => `  "${name}": { width: ${sizes[name].width}, height: ${sizes[name].height} },`)
    .join("\n");
  const previous = (() => {
    try {
      return readFileSync(MANIFEST, "utf8");
    } catch {
      return "";
    }
  })();
  const next = `// Generated by e2e/docs-screenshots/capture.spec.ts (npm run docs:screenshots). Do not edit.
// Pixel size of each screenshot in public/docs/screenshots/, so a figure reserves its
// box before the image arrives. Both themes of one shot are the same size.

export const DOCS_SCREENSHOTS = {
${body}
} as const;

export type DocsScreenshot = keyof typeof DOCS_SCREENSHOTS;
`;
  if (next !== previous) writeFileSync(MANIFEST, next);
}
