import type { Page } from "@playwright/test";

/**
 * Answers the editor's reverse-geocode call ("what address is this pin at?")
 * locally. The real route spends a lookup on the account's allowance and a
 * Geoapify credit, which a test run has no business doing.
 *
 * `candidate: null` is the route's own answer for open water, and the editor
 * leaves the address blank — so the pin keeps its "Location N" name.
 */
export async function mockReverseGeocode(page: Page): Promise<void> {
  await page.route("**/api/maps/*/geocode/reverse", (route) =>
    route.fulfill({ json: { data: { candidate: null } } }),
  );
}

/**
 * Answers "Find an address" locally with one confident match, in the route's
 * own shape (`app/api/maps/[id]/geocode`). Same reason as above: a search is a
 * metered lookup.
 */
export async function mockAddressSearch(
  page: Page,
  match: { lat: number; lng: number; label: string; title: string },
): Promise<void> {
  await page.route("**/api/maps/*/geocode", (route) =>
    route.fulfill({ json: { data: { candidates: [{ ...match, confidence: 0.95 }] } } }),
  );
}
