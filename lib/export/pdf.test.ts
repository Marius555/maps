import { describe, expect, it } from "vitest";

import { singleImagePdf } from "./pdf";

/**
 * A hand-written PDF fails in exactly one way that matters: a cross-reference
 * offset that does not point at its object. Nothing warns — the viewer shows a
 * blank page or offers to repair the file — so the offsets are what these tests
 * are mostly about.
 *
 * They read the bytes back rather than comparing against a fixture, because a
 * fixture would have to be regenerated on every wording change and would then
 * prove only that the output had not moved, which is not the same as it being
 * correct.
 */

/** Enough of a JPEG for the container's purposes: it is passed through opaque. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0xff, 0xd9]);

function build(overrides: Partial<Parameters<typeof singleImagePdf>[0]> = {}) {
  return singleImagePdf({
    jpeg: JPEG,
    pixelWidth: 3508,
    pixelHeight: 2480,
    widthPt: 841.89,
    heightPt: 595.28,
    now: new Date(Date.UTC(2026, 7, 22, 9, 30, 0)),
    ...overrides,
  });
}

/** Latin-1, matching the writer: every byte is one character. */
function text(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

describe("singleImagePdf", () => {
  it("starts with a header a reader will accept", () => {
    expect(text(build().slice(0, 8))).toBe("%PDF-1.4");
  });

  it("ends with the trailer keyword", () => {
    expect(text(build()).trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("points every cross-reference entry at its own object", () => {
    const pdf = build();
    const source = text(pdf);

    // `indexOf("\nxref\n")`, not `lastIndexOf("xref\n")` — the last occurrence of
    // that is inside `startxref`, which sits *after* the table it points at.
    const table = source.slice(source.indexOf("\nxref\n"));
    const entries = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
      Number(match[1]),
    );

    // Six objects: catalog, pages, page, contents, image, info.
    expect(entries).toHaveLength(6);

    entries.forEach((offset, index) => {
      // The whole point of the table. A byte out here is a file that opens blank.
      expect(source.slice(offset).startsWith(`${index + 1} 0 obj\n`)).toBe(true);
    });
  });

  it("points startxref at the table", () => {
    const source = text(build());
    const start = Number(/startxref\n(\d+)/.exec(source)?.[1]);

    expect(source.slice(start, start + 4)).toBe("xref");
  });

  it("declares the stream lengths it actually wrote", () => {
    const source = text(build());

    for (const match of source.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
      const declared = Number(match[1]);
      const from = (match.index ?? 0) + match[0].length;

      /*
       * Ten characters, not nine. `/Length` counts the stream data alone and the
       * spec allows an end-of-line before `endstream`; the content stream ends in
       * one of its own and the image stream is given one, so the keyword lands at
       * the declared length or one byte past it.
       */
      expect(source.slice(from + declared, from + declared + 10)).toContain(
        "endstream",
      );
    }
  });

  it("carries the image through untouched", () => {
    const pdf = build();
    const at = text(pdf).indexOf("/DCTDecode");

    expect(at).toBeGreaterThan(0);
    // The JPEG's own start-of-image marker, byte for byte, after the dictionary.
    const stream = text(pdf).indexOf("stream\n", at) + "stream\n".length;
    expect([...pdf.slice(stream, stream + JPEG.length)]).toEqual([...JPEG]);
  });

  it("sizes the page and the drawing matrix alike", () => {
    const source = text(build());

    expect(source).toContain("/MediaBox [0 0 841.89 595.28]");
    // Anything else and the image is drawn at one size on a page of another.
    expect(source).toContain("841.89 0 0 595.28 0 0 cm");
  });

  it("states the image's real pixel size", () => {
    expect(text(build())).toContain("/Width 3508 /Height 2480");
  });

  it("escapes a title that would otherwise end the string early", () => {
    const source = text(build({ title: "Stores (all) \\ 2026" }));

    expect(source).toContain("/Title (Stores \\(all\\) \\\\ 2026)");
  });

  it("drops characters a literal string cannot carry", () => {
    // PDFDocEncoding has no byte for these, and a mojibake title is worse than
    // none — the offsets stay right either way, which is what matters.
    const source = text(build({ title: "Café 東京 🗺" }));

    expect(source).toContain("/Title (Caf ");
  });

  it("stays byte-identical for the same input", () => {
    // The offsets are measured, not computed, so this is the cheap way to notice
    // a change that moves them.
    expect([...build()]).toEqual([...build()]);
  });
});
