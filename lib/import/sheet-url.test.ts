import { describe, expect, it } from "vitest";

import { parseSheetUrl } from "./sheet-url";

/** Narrows to the success branch so a failure reads as a test failure, not a type error. */
function reference(input: string) {
  const result = parseSheetUrl(input);
  if (!result.ok) throw new Error(`expected a sheet, got: ${result.message}`);

  return result.reference;
}

describe("parseSheetUrl", () => {
  it("reads the id from a share link", () => {
    expect(
      reference("https://docs.google.com/spreadsheets/d/1AbC-dEf_2/edit"),
    ).toMatchObject({ sheetId: "1AbC-dEf_2", published: false });
  });

  it("reads the tab from the fragment", () => {
    // The gid lives in the fragment, which browsers never send — parsing it here
    // is the whole reason this runs client-side.
    expect(
      reference(
        "https://docs.google.com/spreadsheets/d/1AbC-dEf_2/edit#gid=847362",
      ).gid,
    ).toBe("847362");
  });

  it("reads the tab from the query string", () => {
    expect(
      reference(
        "https://docs.google.com/spreadsheets/d/1AbC-dEf_2/edit?gid=847362",
      ).gid,
    ).toBe("847362");
  });

  it("has no tab when the link doesn't name one", () => {
    expect(
      reference("https://docs.google.com/spreadsheets/d/1AbC-dEf_2/edit").gid,
    ).toBeUndefined();
  });

  it("recognises a publish-to-web link", () => {
    // /d/e/ carries a publish token rather than the document id and exports from
    // a different path, so it has to be told apart from a normal share link.
    expect(
      reference(
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vAbCd/pubhtml",
      ),
    ).toMatchObject({ sheetId: "2PACX-1vAbCd", published: true });
  });

  it("accepts a link pasted without its scheme", () => {
    expect(
      reference("docs.google.com/spreadsheets/d/1AbC-dEf_2/edit").sheetId,
    ).toBe("1AbC-dEf_2");
  });

  it("rejects a link to another host", () => {
    const result = parseSheetUrl("https://evil.example.com/spreadsheets/d/abc");

    expect(result.ok).toBe(false);
  });

  it("rejects a Google link that isn't a sheet", () => {
    expect(parseSheetUrl("https://docs.google.com/document/d/abc").ok).toBe(
      false,
    );
  });

  it("rejects something that isn't a link at all", () => {
    expect(parseSheetUrl("my stockists").ok).toBe(false);
  });

  it("asks for a link when given nothing", () => {
    const result = parseSheetUrl("   ");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Paste");
  });
});
