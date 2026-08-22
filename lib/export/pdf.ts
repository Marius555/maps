/**
 * One JPEG → a one-page PDF, written by hand.
 *
 * A PDF holding a single full-bleed image is a small, completely specified
 * document: five objects, a cross-reference table of byte offsets, and a
 * trailer. The image itself needs no encoding work at all — `/DCTDecode` means
 * "the stream is a JPEG", so the bytes the canvas produced go in untouched.
 *
 * Written rather than imported for the reason `lib/import/sources/xlsx.ts` was:
 * CLAUDE.md §3 says ask before adding a dependency, and the answer here is that
 * jsPDF is 350KB to do a hundred and thirty lines of arithmetic we can read.
 * It also keeps the exporter free of a library that would have to be lazy-loaded
 * and version-tracked forever for one feature.
 *
 * The one thing that has to be exactly right is the cross-reference table: every
 * entry is the byte offset of its object, and a viewer that finds an object
 * somewhere other than where the table says either shows a blank page or offers
 * to repair the file. Which is why the offsets are measured off the assembled
 * bytes rather than computed from string lengths — a multi-byte character in a
 * title would put every later offset out by one.
 */

/** Every object in the file, in the order they are written. */
const CATALOG = 1;
const PAGES = 2;
const PAGE = 3;
const CONTENTS = 4;
const IMAGE = 5;
const INFO = 6;
const OBJECT_COUNT = 7;

export type PdfImage = {
  /** The JPEG's own bytes, passed through under `/DCTDecode`. */
  jpeg: Uint8Array;
  /** The image's real pixel dimensions. */
  pixelWidth: number;
  pixelHeight: number;
  /** The page box, in PostScript points. The image fills it exactly. */
  widthPt: number;
  heightPt: number;
  title?: string;
  /** Fixed in tests so the bytes are reproducible. */
  now?: Date;
};

export function singleImagePdf(image: PdfImage): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets = new Array<number>(OBJECT_COUNT).fill(0);
  let length = 0;

  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };

  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  /*
   * 1.4 rather than something newer. Nothing here uses a feature added since,
   * and the older the version a file claims, the more readers open it without
   * comment. The binary comment on the second line is conventional: it marks the
   * file as binary for anything transferring it in text mode.
   */
  push("%PDF-1.4\n%âãÏÓ\n");

  startObject(CATALOG);
  push(`<< /Type /Catalog /Pages ${PAGES} 0 R >>\nendobj\n`);

  startObject(PAGES);
  push(`<< /Type /Pages /Kids [${PAGE} 0 R] /Count 1 >>\nendobj\n`);

  startObject(PAGE);
  push(
    `<< /Type /Page /Parent ${PAGES} 0 R ` +
      `/MediaBox [0 0 ${round(image.widthPt)} ${round(image.heightPt)}] ` +
      `/Resources << /XObject << /Im0 ${IMAGE} 0 R >> >> ` +
      `/Contents ${CONTENTS} 0 R >>\nendobj\n`,
  );

  /*
   * The content stream, in full.
   *
   * `Do` draws an image into the unit square at the origin, so the matrix before
   * it is what gives the image its size: `w 0 0 h 0 0 cm` scales that square to
   * the page. `q`/`Q` bracket the change so it applies to nothing else — there
   * is nothing else on this page, and the brackets are still what makes that a
   * fact about the file rather than a coincidence.
   */
  const content = `q\n${round(image.widthPt)} 0 0 ${round(image.heightPt)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encode(content);

  startObject(CONTENTS);
  push(`<< /Length ${contentBytes.length} >>\nstream\n`);
  push(contentBytes);
  push("endstream\nendobj\n");

  startObject(IMAGE);
  push(
    `<< /Type /XObject /Subtype /Image ` +
      `/Width ${image.pixelWidth} /Height ${image.pixelHeight} ` +
      // A JPEG from a canvas is always three-channel 8-bit colour. It is stated
      // rather than read out of the stream because the stream is opaque to us —
      // that is the point of passing it through.
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
      `/Filter /DCTDecode /Length ${image.jpeg.length} >>\nstream\n`,
  );
  push(image.jpeg);
  push("\nendstream\nendobj\n");

  startObject(INFO);
  push(
    `<< /Producer ${literal("Made with a map builder")} ` +
      `/CreationDate ${literal(pdfDate(image.now ?? new Date()))}` +
      (image.title ? ` /Title ${literal(image.title)}` : "") +
      ` >>\nendobj\n`,
  );

  /*
   * The cross-reference table. Every entry is exactly twenty bytes — ten digits
   * of offset, five of generation, a keyword and two spaces — and a reader seeks
   * into it by multiplying, so a byte out anywhere is a broken file rather than
   * a misaligned one. Object zero is the head of the free list and always reads
   * this way.
   */
  const xref = length;
  push(`xref\n0 ${OBJECT_COUNT}\n`);
  push("0000000000 65535 f \n");

  for (let id = 1; id < OBJECT_COUNT; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }

  push(
    `trailer\n<< /Size ${OBJECT_COUNT} /Root ${CATALOG} 0 R /Info ${INFO} 0 R >>\n` +
      `startxref\n${xref}\n%%EOF\n`,
  );

  return concat(chunks, length);
}

/**
 * Text in a PDF literal string.
 *
 * Three characters end the string or escape the next one and have to be escaped
 * themselves; everything outside Latin-1 is dropped rather than mis-encoded,
 * because a literal string with no `/Encoding` beside it is PDFDocEncoding and
 * there is no byte in it that means "emoji". A title is a nicety and a mojibake
 * title is worse than none.
 */
function literal(text: string): string {
  const safe = text
    .replace(/[\\()]/g, (match) => `\\${match}`)
    .replace(/[^\x20-\x7e]/g, "");

  return `(${safe})`;
}

/** The date format PDF uses, which is its own. */
function pdfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Two decimals is a hundredth of a point — well under a printer's resolution. */
function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Latin-1, not UTF-8.
 *
 * Everything written here is either ASCII or the binary header comment, and the
 * comment's bytes have to survive as the bytes they are — `TextEncoder` would
 * turn each of them into two, which moves every offset in the file.
 */
function encode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function concat(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let at = 0;

  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }

  return out;
}
