import { describe, expect, it } from "vitest";

import { subjectLabel, supportRequestSchema } from "./support.schema";

const bug = {
  kind: "bug",
  area: "import",
  message: "  The map goes blank after import.  ",
  replyTo: " owner@example.com ",
};

describe("supportRequestSchema", () => {
  it("accepts a bug report and trims it", () => {
    const parsed = supportRequestSchema.parse({ ...bug, page: "/maps/abc", viewport: "1280x800" });

    expect(parsed.message).toBe("The map goes blank after import.");
    expect(parsed.replyTo).toBe("owner@example.com");
  });

  it("accepts a support request with a topic", () => {
    const parsed = supportRequestSchema.parse({
      kind: "support",
      topic: "billing",
      message: "Can I move to yearly billing?",
      replyTo: "owner@example.com",
    });

    expect(subjectLabel(parsed)).toBe("Billing");
  });

  it("refuses a message too short to act on", () => {
    expect(supportRequestSchema.safeParse({ ...bug, message: "   broken " }).success).toBe(false);
  });

  it("refuses one over 4,000 characters", () => {
    expect(supportRequestSchema.safeParse({ ...bug, message: "a".repeat(4001) }).success).toBe(false);
  });

  it("refuses a reply address that is not one", () => {
    expect(supportRequestSchema.safeParse({ ...bug, replyTo: "owner@" }).success).toBe(false);
  });

  it("refuses an area that belongs to the other kind", () => {
    expect(supportRequestSchema.safeParse({ ...bug, area: "billing" }).success).toBe(false);
  });

  it("labels a bug by its area", () => {
    expect(subjectLabel(supportRequestSchema.parse(bug))).toBe("Import");
  });
});
