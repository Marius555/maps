import { useEffect } from "react";

/**
 * ArrowLeft / ArrowRight step through the photos, for as long as the caller is
 * mounted — which is exactly as long as the lightbox is open.
 *
 * On `window` rather than on the dialog, because focus sits on whichever button
 * was pressed last and a key handler on one element would stop answering the
 * moment focus moved. Escape is the Modal's own.
 */
export function useLightboxKeys(step: (delta: number) => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);
}
