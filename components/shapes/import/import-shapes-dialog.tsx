"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { formatCount } from "@/lib/format/number";
import { MAX_SOURCE_BYTES, formatMb } from "@/lib/import/limits";
import {
  parseShapeFile,
  type Axis,
  type ShapeImport,
} from "@/lib/import/shapes";
import { ImportSourceError } from "@/lib/import/sources/types";
import { nextShapeDefaults } from "@/lib/map/next-shape-defaults";
import { useBulkCreateShapes } from "@/lib/query/import";
import type { Shape } from "@/lib/repositories/types";
import {
  MAX_BULK_SHAPES,
  type CreateShapeInput,
} from "@/lib/validation/shape.schema";
import { ImportPreview } from "./import-preview";
import { ShapeFileDrop } from "./shape-file-drop";

/**
 * Import shapes from a file of geometry.
 *
 * A dialog, not a wizard. The locations import has four steps because addresses
 * need a column mapping and then a geocoding pass, and both can go wrong in ways
 * only the user can settle. Geometry needs neither: the file already says where
 * everything is. What is left is "here is what I found, shall I save it", which
 * is one screen.
 *
 * Two states, and the file is the switch between them. There is no back button
 * because there is nothing to go back *to* — picking a different file is the
 * same gesture as picking the first one, so the dropzone simply returns.
 */
export function ImportShapesDialog({
  mapId,
  isOpen,
  shapes,
  limit,
  onClose,
}: {
  mapId: string;
  isOpen: boolean;
  /** The map's current shapes — for the headroom sum and for numbering. */
  shapes: Shape[];
  /** The plan's ceiling for this map. */
  limit: number;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<ShapeImport | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  /*
   * The file's own text, kept for as long as its preview is up.
   *
   * A file that gives no way to tell longitude from latitude gets a switch in the
   * preview, and answering it means reading the file again the other way round —
   * so the parse is not the only thing worth keeping. A `File` handle would do it
   * too and would be worse: it can go stale while the dialog is open, and reading
   * it again is asynchronous for no reason when the bytes are already here.
   */
  const [text, setText] = useState<string | null>(null);

  const bulkCreate = useBulkCreateShapes(mapId);

  const headroom = Math.max(limit - shapes.length, 0);
  const overflows = (parsed?.shapes.length ?? 0) > headroom;

  const reset = () => {
    setParsed(null);
    setFileName(null);
    setText(null);
    setReadError(null);
    bulkCreate.reset();
  };

  const pick = async (file: File) => {
    setReadError(null);
    setIsReading(true);

    try {
      // Checked before reading rather than after: the point of a size limit is
      // not to pull 200MB into the tab and then object to it.
      if (file.size > MAX_SOURCE_BYTES) {
        throw new ImportSourceError(
          `That file is over ${formatMb(MAX_SOURCE_BYTES)}. Simplify it in your GIS tool and try again.`,
        );
      }

      const contents = await file.text();
      const result = parseShapeFile(contents);

      setParsed(result);
      setText(contents);
      setFileName(file.name);
    } catch (error) {
      setReadError(
        error instanceof ImportSourceError
          ? error.message
          : "We couldn't read that file. Check it's GeoJSON, TopoJSON or ArcGIS JSON and try again.",
      );
    } finally {
      setIsReading(false);
    }
  };

  /**
   * Read the same bytes the other way round.
   *
   * Only ever reachable from the preview's own switch, which only appears when
   * the file could not settle the question itself. A failure here leaves the
   * previous parse on screen: the user asked to see the file differently, not to
   * lose it.
   */
  const swapAxis = (latitudeFirst: boolean) => {
    if (!text) return;

    const axis: Axis = latitudeFirst ? "latlng" : "lnglat";

    try {
      setParsed(parseShapeFile(text, { axis }));
      setReadError(null);
    } catch (error) {
      setReadError(
        error instanceof ImportSourceError
          ? error.message
          : "Read that way round, the file has no shapes we can draw.",
      );
    }
  };

  const confirm = async () => {
    if (!parsed || overflows) return;

    /*
     * Numbered from what is already on the map, so an import into a map that
     * already has "Area 1" does not produce a second one. `nextShapeDefaults`
     * owns that rule for drawn shapes; asking it once here and counting on from
     * its answer keeps one source for it.
     */
    const base = nextShapeDefaults(shapes, "polygon");
    let sortOrder = base.sortOrder;

    const inputs: CreateShapeInput[] = parsed.shapes.map((shape) => ({
      name: shape.name,
      geometry: shape.geometry,
      color: shape.color,
      opacity: shape.opacity,
      // Only when the file had one. Absent and present-but-empty are different
      // to the schema, and a blank description is not a description.
      ...(shape.description ? { description: shape.description } : {}),
      sortOrder: sortOrder++,
    }));

    try {
      // Chunked to the schema's own cap. A boundary file is heavy — 500 points
      // apiece — so this is about payload size, not row count.
      for (let start = 0; start < inputs.length; start += MAX_BULK_SHAPES) {
        await bulkCreate.mutateAsync(inputs.slice(start, start + MAX_BULK_SHAPES));
      }

      reset();
      onClose();
    } catch {
      // Rendered inline below. Deliberately not a toast: the dialog is still
      // open over the map, and an alert behind it is an alert nobody sees.
    }
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        reset();
        onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[520px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Import shapes</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-3">
            {parsed ? (
              <>
                {fileName ? (
                  <p className="truncate text-xs text-muted">{fileName}</p>
                ) : null}
                <ImportPreview
                  parsed={parsed}
                  headroom={headroom}
                  onSwapAxis={swapAxis}
                />
              </>
            ) : (
              <ShapeFileDrop isBusy={isReading} onPick={(file) => void pick(file)} />
            )}

            {readError ? <ErrorMessage error={readError} /> : null}
            {bulkCreate.error ? <ErrorMessage error={bulkCreate.error} /> : null}
          </Modal.Body>

          <Modal.Footer>
            {parsed ? (
              <>
                <Button variant="tertiary" onPress={reset}>
                  Choose another file
                </Button>
                <Button
                  isPending={bulkCreate.isPending}
                  isDisabled={overflows}
                  onPress={() => void confirm()}
                >
                  {/* The count on the button, as everywhere else here: it is the
                      last thing read before the press. */}
                  Import {formatCount(parsed.shapes.length)}
                </Button>
              </>
            ) : (
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
