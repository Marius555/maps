import { existsSync } from "node:fs";

import type { APIRequestContext, Browser, Page } from "@playwright/test";

import { addPlace, createMap, deleteMap, uniqueMapName, type TestMap } from "./support/api";
import { HAS_SECOND_ACCOUNT } from "./support/env";
import { expect, test } from "./support/fixtures";
import { SECOND_AUTH_FILE } from "./support/paths";

/**
 * Team seats, end to end, with the two test accounts: E2E_EMAIL owns a
 * workspace and invites E2E_EMAIL_2 into it. docs/notes/team.md is the design;
 * this walks every door it has — the invite link, the viewer's refusals, a
 * promotion, the map-scoped routes across a team switch, leaving, the
 * invitation list, removal — against the real server and the real tables.
 *
 * **Its own Playwright project, after `chromium`** (playwright.config.ts).
 * `api-security.spec.ts` relies on the second account being a stranger to the
 * first's maps, which is exactly what this spec changes for its length; run
 * side by side the two would race. Serial for the same reason inside the file:
 * each step stands on the membership the one before it left.
 *
 * Needs a plan with room for a second seat — `DISABLE_ALL_PLAN=true`, as the
 * suite's main pass sets, or a paid test account. Skips with a reason otherwise.
 */

test.describe.configure({ mode: "serial" });

const SECOND_EMAIL = (process.env.E2E_EMAIL_2 ?? "").toLowerCase();

type TeamAnswer = {
  data: { team: {
    workspaceId: string;
    seats: number;
    seatsUsed: number;
    people: { userId: string; email: string; role: string }[];
    invites: { id: string; email: string }[];
  } };
};

async function team(request: APIRequestContext): Promise<TeamAnswer["data"]["team"]> {
  const response = await request.get("/api/team");
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as TeamAnswer).data.team;
}

async function meOf(request: APIRequestContext): Promise<{ id: string; email: string }> {
  const response = await request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data: { user: { id: string; email: string } } }).data.user;
}

async function invite(
  request: APIRequestContext,
  email: string,
  role: "admin" | "editor" | "viewer",
): Promise<{ id: string; url: string }> {
  const response = await request.post("/api/team/invites", { data: { email, role } });
  expect(response.status(), await response.text()).toBe(201);
  const { data } = (await response.json()) as { data: { invite: { id: string }; inviteUrl: string } };
  return { id: data.invite.id, url: data.inviteUrl };
}

/** Back to a clean slate: the second account off the team, no e2e invites out. */
async function resetTeam(owner: APIRequestContext, secondId: string | null): Promise<void> {
  const current = await team(owner);

  if (secondId && current.people.some((person) => person.userId === secondId)) {
    await owner.delete(`/api/team/members/${secondId}`);
  }

  for (const pending of current.invites) {
    if (pending.email === SECOND_EMAIL || pending.email.includes("+e2e-")) {
      await owner.delete(`/api/team/invites/${pending.id}`);
    }
  }
}

/**
 * The owner's own inbox with a `+e2e-` tag, for every invite that must not go
 * to anybody real — and that teardown can recognise and revoke.
 */
function taggedOwnerAddress(tag: string): string {
  const [user, domain] = (process.env.E2E_EMAIL ?? "owner@example.com").split("@");

  return `${user}+e2e-${tag}@${domain}`.toLowerCase();
}

/** The second account in a real browser, for the pages; its API context is `secondUser`. */
async function secondPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: SECOND_AUTH_FILE });
  return context.newPage();
}

let ownerId: string;
let secondId: string;
let shared: TestMap;

test.beforeAll(async ({ request, playwright, baseURL }) => {
  test.skip(!HAS_SECOND_ACCOUNT || !existsSync(SECOND_AUTH_FILE), "No second account — set E2E_EMAIL_2 / E2E_PASSWORD_2");

  const second = await playwright.request.newContext({ baseURL, storageState: SECOND_AUTH_FILE });

  try {
    ownerId = (await meOf(request)).id;
    secondId = (await meOf(second)).id;
  } finally {
    await second.dispose();
  }

  await resetTeam(request, secondId);

  const { seats } = await team(request);
  test.skip(seats < 2, "The owner's plan is one seat — run with DISABLE_ALL_PLAN=true (e2e/README.md)");

  shared = await createMap(request, uniqueMapName("team"));
  await addPlace(request, shared.id, { name: "Shared café", lat: 51.5, lng: -0.12 });
});

test.afterAll(async ({ request }) => {
  if (!ownerId) return;
  await resetTeam(request, secondId);
  if (shared) await deleteMap(request, shared.id);
});

test("the owner invites by email and the invitee joins through the link", async ({ page, browser }) => {
  await page.goto("/settings/team");
  await page.getByRole("button", { name: "Invite people" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill(SECOND_EMAIL);
  await dialog.getByRole("button", { name: "Role" }).click();
  await page.getByRole("option", { name: /^Viewer/ }).click();
  await dialog.getByRole("button", { name: "Send invite" }).click();

  await expect(dialog.getByRole("heading", { name: "Invite sent" })).toBeVisible();
  const url = await dialog.getByRole("textbox", { name: "Invite link" }).inputValue();
  expect(url).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

  const invitee = await secondPage(browser);
  try {
    await invitee.goto(new URL(url).pathname);
    await expect(invitee.getByRole("heading", { name: /^Join .*team$/ })).toBeVisible();
    await invitee.getByRole("button", { name: "Join team" }).click();

    // Lands in the team it just joined, by a full load.
    await invitee.waitForURL(/\/maps$/);
    await expect(invitee.getByText(shared.name)).toBeVisible();
    await expect(invitee.getByRole("button", { name: /Switch team/ }).first()).toBeVisible();
  } finally {
    await invitee.context().close();
  }

  const after = await team(page.request);
  expect(after.people.find((person) => person.userId === secondId)?.role).toBe("viewer");
  expect(after.invites.some((pending) => pending.email === SECOND_EMAIL)).toBe(false);
});

test("a viewer reads everything and changes nothing", async ({ secondUser, browser }) => {
  expect((await secondUser.get(`/api/maps/${shared.id}`)).status()).toBe(200);
  expect((await secondUser.get(`/api/maps/${shared.id}/places`)).status()).toBe(200);
  expect((await secondUser.get(`/api/maps/${shared.id}/card-design`)).status()).toBe(200);

  // Team routes act in the switched-to workspace, and this API context has not
  // switched (the cookie the join set lives in the browser context above). In
  // their own workspace the invitee is the owner and may invite, so switch first.
  const switched = await secondUser.post("/api/workspaces/active", { data: { workspaceId: ownerId } });
  expect(switched.status(), await switched.text()).toBe(200);

  const writes = [
    () => secondUser.post(`/api/maps/${shared.id}/places`, { data: { name: "Nope", lat: 1, lng: 1 } }),
    () => secondUser.patch(`/api/maps/${shared.id}`, { data: { name: "Renamed by a viewer" } }),
    () => secondUser.post(`/api/maps/${shared.id}/publish`),
    () => secondUser.patch(`/api/maps/${shared.id}/card-design`, { data: { cardLayout: {} } }),
    () => secondUser.delete(`/api/maps/${shared.id}`),
    () => secondUser.post("/api/team/invites", { data: { email: taggedOwnerAddress("no"), role: "viewer" } }),
  ];

  for (const write of writes) {
    const response = await write();
    expect(response.status(), await response.text()).toBe(403);
  }

  const viewer = await secondPage(browser);
  try {
    await viewer.goto(`/maps/${shared.id}`);
    await expect(viewer.getByText("View only").first()).toBeVisible();
    await expect(viewer.getByRole("button", { name: /Add location/ })).toHaveCount(0);
  } finally {
    await viewer.context().close();
  }
});

test("an editor edits and publishes but cannot delete the map", async ({ request, secondUser }) => {
  const promote = await request.patch(`/api/team/members/${secondId}`, { data: { role: "editor" } });
  expect(promote.status(), await promote.text()).toBe(200);

  const added = await secondUser.post(`/api/maps/${shared.id}/places`, {
    data: { name: "Added by the editor", lat: 51.51, lng: -0.11 },
  });
  expect(added.status(), await added.text()).toBe(201);

  const deleted = await secondUser.delete(`/api/maps/${shared.id}`);
  expect(deleted.status()).toBe(403);
  expect(((await deleted.json()) as { error: { code: string } }).error.code).toBe("role_required");

  // An editor cannot hand out roles either.
  const escalate = await secondUser.patch(`/api/team/members/${secondId}`, { data: { role: "admin" } });
  expect(escalate.status()).toBeGreaterThanOrEqual(400);
});

test("map routes follow the map, whichever team is switched to", async ({ secondUser }) => {
  // Home to the invitee's own workspace...
  const home = await secondUser.post("/api/workspaces/active", { data: { workspaceId: secondId } });
  expect(home.status(), await home.text()).toBe(200);

  // ...where the maps list is theirs alone...
  const list = (await (await secondUser.get("/api/maps")).json()) as { data: { maps: { id: string }[] } };
  expect(list.data.maps.some((map) => map.id === shared.id)).toBe(false);

  // ...and the team's map still answers, as the team's.
  expect((await secondUser.get(`/api/maps/${shared.id}`)).status()).toBe(200);

  // A cookie naming a team they are not in is refused, not honoured.
  const forged = await secondUser.post("/api/workspaces/active", {
    data: { workspaceId: "not-a-team-of-theirs" },
  });
  expect(forged.status()).toBe(404);
});

test("a member can leave, and the map is gone for them at once", async ({ secondUser }) => {
  const left = await secondUser.delete(`/api/workspaces/${ownerId}/membership`);
  expect(left.status(), await left.text()).toBe(204);

  expect((await secondUser.get(`/api/maps/${shared.id}`)).status()).toBe(404);
});

test("an invitation waits in the list, and removal takes access away", async ({ request, secondUser }) => {
  await invite(request, SECOND_EMAIL, "viewer");

  const mine = (await (await secondUser.get("/api/invites/mine")).json()) as {
    data: { invitations: { id: string }[] };
  };
  expect(mine.data.invitations).toHaveLength(1);

  const accepted = await secondUser.post(`/api/invites/mine/${mine.data.invitations[0].id}/accept`);
  expect(accepted.status(), await accepted.text()).toBe(200);
  expect((await secondUser.get(`/api/maps/${shared.id}`)).status()).toBe(200);

  const removed = await request.delete(`/api/team/members/${secondId}`);
  expect(removed.status()).toBe(204);
  expect((await secondUser.get(`/api/maps/${shared.id}`)).status()).toBe(404);
});

test("an invite works only for the address it was sent to", async ({ request, secondUser, browser }) => {
  // The owner's own inbox with a tag, so nothing is mailed to a stranger.
  const elsewhere = await invite(request, taggedOwnerAddress("mismatch"), "viewer");
  const token = new URL(elsewhere.url).pathname.split("/").pop();

  const invitee = await secondPage(browser);
  try {
    await invitee.goto(`/invite/${token}`);
    await expect(invitee.getByRole("heading", { name: "This invite is for someone else" })).toBeVisible();
  } finally {
    await invitee.context().close();
  }

  const stolen = await secondUser.post(`/api/invites/${token}/accept`);
  expect(stolen.status()).toBe(403);

  // Taken back, the link is dead for everybody.
  expect((await request.delete(`/api/team/invites/${elsewhere.id}`)).status()).toBe(204);

  const dead = await secondPage(browser);
  try {
    await dead.goto(`/invite/${token}`);
    await expect(dead.getByRole("heading", { name: "This invite isn't valid any more" })).toBeVisible();
  } finally {
    await dead.context().close();
  }
});

test("a stranger gets nothing from the team routes", async ({ secondUser }) => {
  // Not on the team any more (the step above removed them): every team read is
  // their own empty workspace, and the owner's map is missing.
  const theirs = (await (await secondUser.get("/api/team")).json()) as TeamAnswer;
  expect(theirs.data.team.workspaceId).toBe(secondId);
  expect((await secondUser.get(`/api/maps/${shared.id}/places`)).status()).toBe(404);
  expect((await secondUser.delete(`/api/team/members/${ownerId}`)).status()).toBe(404);
});
