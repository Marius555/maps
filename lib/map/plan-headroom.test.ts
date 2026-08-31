import { describe, expect, it } from "vitest";

import { headroomMessage, isAtLimit } from "./plan-headroom";

/**
 * The toolbar greys its controls on `isAtLimit` and explains itself with
 * `headroomMessage`, so these two decide whether a customer can add a location
 * at all. The UI they drive is not tested — §9 skips layout — but the answers
 * they give are.
 */

describe("isAtLimit", () => {
  it("leaves room below the ceiling", () => {
    expect(isAtLimit({ plan: "free", limit: 10, used: 9 })).toBe(false);
  });

  it("is reached exactly at the ceiling", () => {
    // The repositories refuse on `>= limit`, so the tenth location fills a free
    // map rather than leaving one slot the menu would still offer.
    expect(isAtLimit({ plan: "free", limit: 10, used: 10 })).toBe(true);
  });

  it("stays reached past the ceiling", () => {
    /*
     * A map can hold more than its plan allows: an import that raced another
     * tab, or a subscription that lapsed under a map built on a paid one. `>`
     * rather than `>=` would bring every control back to life at exactly the
     * moment there is least room, which is the case nobody would think to try.
     */
    expect(isAtLimit({ plan: "free", limit: 10, used: 47 })).toBe(true);
  });

  it("treats an empty map on a real plan as having room", () => {
    expect(isAtLimit({ plan: "pro", limit: 3000, used: 0 })).toBe(false);
  });
});

describe("headroomMessage", () => {
  it("names the count and the plan, and stops there", () => {
    const message = headroomMessage("places", { plan: "free", limit: 10, used: 10 });

    expect(message).toBe("You've used all 10 locations included on the free plan.");
  });

  it("leaves the remedy to the toast", () => {
    /*
     * The full `planLimitMessage` ends "delete a location to add another, or
     * upgrade for more". That belongs on something that interrupts and then
     * leaves; this line is read inside a menu the user opened, beside the tiles
     * it is about. Asserted rather than left to the sentence above because the
     * two composers share a file and re-merging them would be a one-word edit.
     */
    expect(headroomMessage("shapes", { plan: "free", limit: 3, used: 3 })).not.toContain(
      "upgrade",
    );
  });

  it("counts shapes in the user's word for them", () => {
    // "shapes", never "rows" or "documents" — §8's first copy rule.
    const message = headroomMessage("shapes", { plan: "free", limit: 3, used: 3 });

    expect(message).toContain("all 3 shapes");
  });

  it("says the plan it was given", () => {
    expect(headroomMessage("shapes", { plan: "starter", limit: 50, used: 50 })).toContain(
      "on the starter plan",
    );
  });

  it("reads the count off the limit, not off what has been used", () => {
    /*
     * The sentence describes the allowance, not the overshoot — "you've used all
     * 10" stays true and stays legible on a map holding 47. This is what keeps
     * the pre-emptive warning and the server's own 403 word-for-word identical:
     * the server composes it from the limit alone, having never counted past it.
     */
    expect(headroomMessage("places", { plan: "free", limit: 10, used: 47 })).toContain(
      "all 10 locations",
    );
  });
});
