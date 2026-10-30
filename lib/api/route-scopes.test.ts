import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every route says which workspace it works in, by which wrapper it uses
 * (lib/api/route.ts). Getting that wrong does not throw — a map route on
 * `withAuth` resolves the active team instead of the map's, and either refuses
 * a member who should get in or, worse, a future change makes it answer. So the
 * choice is checked here against the folder each route lives in, and a route
 * added next month is held to it by being put in the right folder.
 */

const API = join(process.cwd(), "app", "api");

function routesUnder(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) found.push(...routesUnder(path));
    else if (entry === "route.ts") found.push(path);
  }

  return found;
}

const ROUTES = routesUnder(API).map((path) => ({
  name: relative(API, path).split(sep).join("/"),
  source: readFileSync(path, "utf8"),
}));

/** The wrappers a route file calls, by name. */
function wrappersOf(source: string): Set<string> {
  return new Set(source.match(/\bwith(?:Map|Personal)?Auth\b(?=\s*[<(])/g) ?? []);
}

describe("route scopes", () => {
  it("finds the routes it is meant to check", () => {
    expect(ROUTES.filter((route) => route.name.startsWith("maps/[id]/")).length).toBeGreaterThan(20);
  });

  it.each(ROUTES.filter((route) => route.name.startsWith("maps/[id]/")))(
    "resolves $name from the map it is about",
    ({ source }) => {
      expect([...wrappersOf(source)]).toEqual(["withMapAuth"]);
    },
  );

  const PERSONAL = ["account/", "notifications/", "invites/", "workspaces/", "auth/me/", "connect/"];

  it.each(ROUTES.filter((route) => PERSONAL.some((prefix) => route.name.startsWith(prefix))))(
    "runs $name as the person, outside any team",
    ({ source }) => {
      const wrappers = wrappersOf(source);

      expect(wrappers.has("withMapAuth")).toBe(false);
      expect(wrappers.has("withAuth")).toBe(false);
    },
  );

  it("keeps the card design under the map that names its workspace", () => {
    expect(ROUTES.some((route) => route.name === "account/card-design/route.ts")).toBe(false);
    expect(ROUTES.some((route) => route.name === "maps/[id]/card-design/route.ts")).toBe(true);
  });

  it("leaves nothing else on the bare withAuth but the active-workspace routes", () => {
    const bare = ROUTES.filter((route) => wrappersOf(route.source).has("withAuth")).map(
      (route) => route.name,
    );

    expect(bare.sort()).toEqual(
      [
        "maps/route.ts",
        "team/invites/[inviteId]/route.ts",
        "team/invites/route.ts",
        "team/members/[userId]/route.ts",
        "team/route.ts",
      ].sort(),
    );
  });
});
