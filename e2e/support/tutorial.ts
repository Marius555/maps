import type { Page } from "@playwright/test";

/**
 * Clears the onboarding overlay ("Getting started") whenever it shows up, for
 * the rest of this page's life.
 *
 * "Don't show tips again", not the X: the X closes one overlay and the next one
 * in line takes the screen under the same name, so Playwright would wait for a
 * dialog that never goes away. The X's replacement hides every overlay on the
 * page at once. With `TUTORIAL_ALWAYS_PRESENT=true` they all come back on the
 * next load anyway, and this handler fires again then.
 *
 * Dispatched, not clicked. The overlay can mount late, after a test has opened
 * a menu, and React Aria makes everything outside a modal popover inert — so a
 * real click lands on <body> and the handler retries until the test times out.
 * A dispatched click skips hit-testing, `usePress` reads its `detail: 0` as a
 * virtual press, and the menu stays open for the action that was waiting.
 */
export async function dismissTutorials(page: Page): Promise<void> {
  await page.addLocatorHandler(
    page.getByRole("dialog", { name: "Getting started" }),
    async (overlay) => {
      await overlay.getByRole("button", { name: "Don't show tips again" }).dispatchEvent("click");
    },
  );
}
