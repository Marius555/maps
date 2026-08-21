/**
 * Strips case, spaces, punctuation and accents so "Store Name", "store_name"
 * and "STORE-NAME" all match, and so does "Straße" against "strasse".
 *
 * The accent folding is what makes a non-English header table worth having: a
 * German export writes "Straße" and "Größe", a French one "Numéro de téléphone",
 * a Spanish one "Teléfono". Without folding, every one of those misses a synonym
 * spelled the plain way, and the table would need an entry per diacritic
 * variant.
 */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // ß has no decomposed form, so NFD leaves it alone and the strip below would
    // delete it — turning "Straße" into "strae" rather than "strasse".
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
