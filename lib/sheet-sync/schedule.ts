/**
 * How often a linked map syncs on its own, as the UI says it.
 *
 * The schedule itself is the `googleSheetsUpdate` Appwrite Function's cron
 * (`*\/30 * * * *`), which `npm run setup:sheet-sync` sets — change both
 * together. A plain module rather than a `"use client"` one, so server and
 * client components both read the string and not a client reference.
 */
export const AUTO_SYNC_EVERY = "every 30 minutes";
