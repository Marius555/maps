"use client";


import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { AppMap, Group, Place, Shape } from "@/lib/repositories/types";
import { EmbedPreview } from "./embed-preview";

/**
 * The preview as a dialog, for the editor.
 *
 * Children are only mounted while the modal is open, which is what keeps the
 * embed bundle and a second WebGL context out of the editor until asked for.
 */
export function PreviewDialog({
  map,
  places,
  shapes,
  groups,
  isOpen,
  onOpenChange,
}: {
  map: AppMap;
  places: Place[];
  shapes: Shape[];
  /** For the colours they decide — see EmbedPreview. */
  groups: readonly Group[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      dialogClassName="sm:max-w-3xl"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Preview</ResponsiveDialog.Heading>
        <p className="text-xs text-muted">
          Your locations as they are right now, in the real embed. Publish to
          put this on your site.
        </p>
      </ResponsiveDialog.Header>

      <ResponsiveDialog.Body>
        <EmbedPreview
          map={map}
          places={places}
          shapes={shapes}
          groups={groups}
          className="h-[60dvh] min-h-64"
        />
      </ResponsiveDialog.Body>
    </ResponsiveDialog>
  );
}
