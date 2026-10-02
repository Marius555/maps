"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { retryImport } from "@/lib/ui/retry-import";

/*
 * The editor's dialogs, loaded the first time each is opened rather than with
 * the editor.
 *
 * They used to be imported statically and mounted shut, so every visit to a map
 * downloaded, parsed and hydrated seven dialogs nobody had asked for — the
 * location form alone is the largest tree in the editor. `OpenedOnce` mounts
 * each the first time it is wanted and then keeps it mounted, so a closing
 * dialog still plays its exit animation exactly as before.
 *
 * `prefetchEditorDialogs` fetches the code once the editor is idle, so the first
 * open does not wait on the network either: what moved is when the work
 * happens, not whether it does.
 */

const loadPlaceEditDialog = () => import("@/components/places/place-form/place-edit-dialog");
const loadShapeEditDialog = () => import("@/components/shapes/shape-form/shape-edit-dialog");
const loadGroupEditDialog = () => import("@/components/groups/group-form/group-edit-dialog");
const loadPinStudio = () => import("@/components/map/pin-studio/pin-studio");
const loadImportShapesDialog = () => import("@/components/shapes/import/import-shapes-dialog");
const loadClusterIconDialog = () => import("@/components/map/clusters/cluster-icon/cluster-icon-dialog");
const loadPreviewDialog = () => import("@/components/preview/preview-dialog");

export const LazyPlaceEditDialog = dynamic(
  retryImport(() => loadPlaceEditDialog().then((m) => m.PlaceEditDialog)),
  { ssr: false },
);
export const LazyShapeEditDialog = dynamic(
  retryImport(() => loadShapeEditDialog().then((m) => m.ShapeEditDialog)),
  { ssr: false },
);
export const LazyGroupEditDialog = dynamic(
  retryImport(() => loadGroupEditDialog().then((m) => m.GroupEditDialog)),
  { ssr: false },
);
export const LazyPinStudio = dynamic(
  retryImport(() => loadPinStudio().then((m) => m.PinStudio)),
  { ssr: false },
);
export const LazyImportShapesDialog = dynamic(
  retryImport(() => loadImportShapesDialog().then((m) => m.ImportShapesDialog)),
  { ssr: false },
);
export const LazyClusterIconDialog = dynamic(
  retryImport(() => loadClusterIconDialog().then((m) => m.ClusterIconDialog)),
  { ssr: false },
);
export const LazyPreviewDialog = dynamic(
  retryImport(() => loadPreviewDialog().then((m) => m.PreviewDialog)),
  { ssr: false },
);

/** Warms every dialog's code once the browser has nothing better to do. */
export function usePrefetchEditorDialogs(): void {
  useEffect(() => {
    const prefetch = () => {
      for (const load of [
        loadPlaceEditDialog,
        loadShapeEditDialog,
        loadGroupEditDialog,
        loadPinStudio,
        loadImportShapesDialog,
        loadClusterIconDialog,
        loadPreviewDialog,
      ]) {
        // A failure here is only a missed warm-up; the open retries for real.
        load().catch(() => {});
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }

    const timer = window.setTimeout(prefetch, 2000);
    return () => window.clearTimeout(timer);
  }, []);
}

/**
 * Renders `children` from the first time `open` is true, and from then on —
 * shut dialogs included, so their exit animation is never cut short.
 */
export function OpenedOnce({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(open);

  // Adjusting state during render, React's documented pattern for state that
  // follows a prop: no effect, so no frame with the dialog missing.
  if (open && !opened) setOpened(true);

  return opened ? children : null;
}
