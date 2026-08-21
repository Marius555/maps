/**
 * Excel's date serials.
 *
 * A date in a spreadsheet is a plain number wearing a number format. Without
 * this, "opened 12 March 2024" imports as "45363" and nobody can tell what the
 * column was for.
 */

/** Number formats Excel reserves for dates and times. */
const BUILT_IN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47,
]);

/** Milliseconds in a day. */
const DAY_MS = 86_400_000;

export function isDateFormat(numFmtId: number, formatCode?: string): boolean {
  if (BUILT_IN_DATE_FORMATS.has(numFmtId)) return true;
  if (!formatCode) return false;

  // Strip quoted literals and colour/condition brackets first: a currency format
  // like [$-409]#,##0.00 has no date in it, but does contain a "d" and an "m".
  const stripped = formatCode
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "");

  return /[ymdhs]/i.test(stripped);
}

/**
 * Serial → ISO text, in UTC.
 *
 * Day 0 is 30 December 1899 rather than 31 December: Excel deliberately kept
 * Lotus 1-2-3's belief that 1900 was a leap year, and the offset absorbs the
 * phantom 29 February. Workbooks saved by older Mac Excel count from 1904
 * instead, which `date1904` in the workbook flags.
 */
export function formatSerialDate(serial: number, epoch1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 0) return null;

  const epoch = epoch1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.round(serial * DAY_MS));

  if (Number.isNaN(date.getTime())) return null;

  const iso = date.toISOString();
  const hasTime = serial % 1 !== 0;

  // A date-only cell shouldn't grow a midnight timestamp it never had.
  return hasTime ? iso.slice(0, 16).replace("T", " ") : iso.slice(0, 10);
}
