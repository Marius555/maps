/**
 * The Source step's title.
 *
 * Drawn on the first step only: it is the one screen where somebody has not yet
 * committed to anything and benefits from being told what the page is for. The
 * three working steps keep their vertical space for the file.
 *
 * The title is `aria-hidden`, because the page already has its `<h1>` (`PageTitle`, sr-only)
 * saying the same words, and a screen reader would otherwise hear them twice.
 */
export function ImportHeading() {
  return (
    <div className="space-y-1">
      <p aria-hidden="true" className="text-xl font-semibold tracking-tight text-foreground">
        Import locations
      </p>
      <p className="text-sm text-muted">
        Add many locations at once from a spreadsheet.
      </p>
    </div>
  );
}
