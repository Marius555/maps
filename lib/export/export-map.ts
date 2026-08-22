import type { Map as MapLibreMap } from "maplibre-gl";

import { ATTRIBUTION_TEXT } from "@/lib/map/style";
import type { Shape } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { composeExport } from "./compose";
import { budgetError, layoutFor, paperById, qualityById, type PaperId, type QualityId } from "./paper";
import { addPlaceLayers, type ExportPlace } from "./place-features";
import { ExportError, renderMapCanvas, type ExportView } from "./render-map";

/**
 * The whole export, in one call.
 *
 * The pieces around it are each testable on their own — the page arithmetic, the
 * PDF container, the credit — and this is the part that can only be checked by
 * running it: it needs a GPU, a tile server and a canvas. So it does as little as
 * possible beyond ordering the others, and every decision worth arguing about
 * lives in the file it belongs to rather than here.
 */

export const EXPORT_FORMATS = ["png", "jpeg", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportOptions = {
  format: ExportFormat;
  paper: PaperId;
  quality: QualityId;
};

export type ExportInput = {
  view: ExportView;
  places: readonly ExportPlace[];
  shapes: readonly Shape[];
  pinIcons?: readonly CustomPinIcon[];
  /** Names the file, and titles the PDF. */
  title: string;
};

/**
 * JPEG quality.
 *
 * High enough that the ringing around a label is invisible at any print size,
 * and low enough that an A3 at 300 DPI is a few megabytes rather than forty. It
 * applies to the PDF too, which carries its JPEG through untouched.
 */
const JPEG_QUALITY = 0.92;

export type ExportResult = { blob: Blob; filename: string };

export async function exportMapImage(
  input: ExportInput,
  options: ExportOptions,
  addShapeLayers: (map: MapLibreMap) => void,
): Promise<ExportResult> {
  const paper = paperById(options.paper);
  const quality = qualityById(options.quality);
  const layout = layoutFor(paper, quality.dpi, {
    width: input.view.width,
    height: input.view.height,
  });

  // Checked before a map is built rather than after: the failure mode otherwise
  // is a blank image several seconds later, with nothing to say why.
  const refusal = budgetError(layout);
  if (refusal) throw new ExportError(refusal);

  const canvas = await renderMapCanvas(input.view, layout, async (map) => {
    /*
     * Shapes first, locations second.
     *
     * `addShapeLayers` inserts under the basemap's first symbol layer so street
     * names stay legible through a translucent fill; the place layers append on
     * top. Adding them the other way round would put a coloured wash over every
     * pin — the same ordering the editor's canvas keeps, for the same reason.
     */
    addShapeLayers(map);
    await addPlaceLayers(map, input.places, input.pinIcons);
  });

  composeExport(canvas, {
    attribution: ATTRIBUTION_TEXT,
    pixelRatio: layout.pixelRatio,
  });

  if (options.format === "pdf") {
    // Imported here rather than at the top so the PDF writer only reaches the
    // browser when someone actually asks for a PDF.
    const { singleImagePdf } = await import("./pdf");
    const jpeg = new Uint8Array(await (await toBlob(canvas, "image/jpeg")).arrayBuffer());

    const pdf = singleImagePdf({
      jpeg,
      // Read off the canvas, not off the layout: what the browser actually
      // allocated is what the PDF has to describe.
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      widthPt: layout.widthPt,
      heightPt: layout.heightPt,
      title: input.title,
    });

    return {
      blob: new Blob([pdf as BlobPart], { type: "application/pdf" }),
      filename: `${input.title}.pdf`,
    };
  }

  const type = options.format === "jpeg" ? "image/jpeg" : "image/png";

  return {
    blob: await toBlob(canvas, type),
    filename: `${input.title}.${options.format === "jpeg" ? "jpg" : "png"}`,
  };
}

/**
 * `toBlob` rather than `toDataURL`.
 *
 * An A3 at 300 DPI is around 17 megapixels, and a data URI of it is a base64
 * string a third larger again — held as one JavaScript string, on the main
 * thread, for no reason. A Blob is bytes and can be handed straight to a download
 * or to the PDF writer.
 */
function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ExportError("Your browser couldn't turn that map into an image."));
      },
      type,
      JPEG_QUALITY,
    );
  });
}

/**
 * Hand the file to the browser.
 *
 * A synthetic click on an object URL, which is the only way to name a download
 * from a Blob. The URL is revoked on the next tick rather than immediately —
 * revoking it in the same task cancels the download it was created for in some
 * browsers.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A map name → something a filesystem will accept, on every platform. */
export function exportFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return cleaned || "map";
}

export { ExportError };
