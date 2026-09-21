import "server-only";

import { getGeocoder, statusFor, type GeocodeCandidate } from "@/lib/geocoding";
import { env } from "@/lib/env";
import { normalizeAddress } from "@/lib/import/geocode-plan";
import { buildDraftPlaces, type DraftPlace } from "@/lib/import/draft-places";
import { draftToCreateInput } from "@/lib/import/draft-to-place";
import { fetchGoogleSheetCsv } from "@/lib/import/google-sheet-fetch";
import {
  MAIN_TAG_GROUP_LABEL,
  normalizeLabel,
  resolveTags,
} from "@/lib/import/resolve-tags";
import { readCsvText } from "@/lib/import/sources/csv";
import { ImportSourceError } from "@/lib/import/sources/types";
import { buildTable } from "@/lib/import/table";
import { repoContext } from "@/lib/repositories/context";
import { RepositoryError, planFeatureMessage } from "@/lib/repositories/errors";
import { getMap, updateMap } from "@/lib/repositories/maps.repository";
import {
  applySheetPatches,
  createPlaces,
  deletePlacesById,
  listAllPlaces,
} from "@/lib/repositories/places.repository";
import { PLAN_LIMITS, getUserPlan, planAllows } from "@/lib/repositories/plan-limits";
import { publishMap } from "@/lib/repositories/publish.repository";
import {
  claimSheetLink,
  recordSheetSync,
} from "@/lib/repositories/sheet-links.repository";
import type { Place } from "@/lib/repositories/types";
import {
  assertLookupHeadroom,
  recordLookups,
} from "@/lib/repositories/usage.repository";
import { createPlaceSchema, type CreatePlaceInput } from "@/lib/validation/place.schema";
import { diffSheet, type SheetRow } from "./diff";
import { isEmptyPatch, sheetPatch, type SheetPlacePatch } from "./patch";
import { freshFailedLookups, mergeStepReports, reportChangedMap } from "./report";
import { hash } from "./row-key";
import { removalsNeedConfirmation, usableSheetRows } from "./rows";
import {
  MAX_REPORTED_SKIPS,
  type SheetLink,
  type SheetSyncReport,
  type SheetSyncSkip,
  type SheetSyncStatus,
} from "./types";

export type SheetSyncStepOutcome =
  | {
      status: SheetSyncStatus;
      report: SheetSyncReport;
      link: SheetLink;
      /** True when there is work left and the caller should run another step. */
      more: boolean;
    }
  /** Another sync holds the link. Nothing was read and nothing was written. */
  | { status: "busy" };

/**
 * How long one step may spend looking addresses up, in milliseconds.
 *
 * **A sync is a series of short steps, and that is forced by the host.**
 * Appwrite Sites answers no request past its site timeout — 15 seconds by
 * default, 30 at most — and a sheet that gained two hundred addresses is
 * minutes of work at a public geocoder's pace. So each step does a bounded
 * slice and says whether there is more; Sync now repeats it from the browser,
 * the daily Appwrite Function repeats it from there (functions/sheet-sync-daily).
 *
 * The rest of a step — reading the sheet, listing the map, writing, maybe
 * republishing — is a few seconds on top, which is why the default is small.
 * Raise the site's timeout to 30s in the Appwrite console and this can go to
 * about 15000 with `SHEET_SYNC_STEP_MS`.
 */
export function stepBudgetMs(): number {
  const raw = Number(process.env.SHEET_SYNC_STEP_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 5000;
}

/** Writes per step, so the write half of a step stays as bounded as the lookups. */
const MAX_UPDATES_PER_STEP = 60;
const MAX_CREATES_PER_STEP = 200;

/**
 * One step of a map's sync against its linked sheet. docs/notes/sheet-sync.md.
 *
 * Runs on our server, from Sync now or the daily job — never in a visitor's
 * path (§2). Every read and write of the map goes through the same repositories
 * the dashboard uses, as the link's owner, so plan limits and ownership are
 * checked exactly as they are for a press in the editor.
 *
 * **Idempotent by construction.** A step carries nothing from the last one
 * except the locations themselves and the list of addresses known not to
 * resolve: it reads the sheet, diffs it against the map, and writes a bounded
 * slice of the difference. Whatever it leaves, the next step finds again.
 *
 * `continuing` says this step belongs to the same sync as the one before it,
 * so the counts are added up for the owner instead of each step reporting only
 * its own slice.
 */
export async function runSheetSyncStep(
  link: SheetLink,
  {
    confirmRemovals = false,
    continuing = false,
    lookupBudgetMs = stepBudgetMs(),
  }: { confirmRemovals?: boolean; continuing?: boolean; lookupBudgetMs?: number } = {},
): Promise<SheetSyncStepOutcome> {
  if (!(await claimSheetLink(link.id, lookupBudgetMs + 30_000))) return { status: "busy" };

  const failedLookups = freshFailedLookups(link.failedLookups, Date.now());
  const previous =
    continuing && link.lastStatus === "partial" && link.lastReport ? link.lastReport : null;

  let result: { status: SheetSyncStatus; report: SheetSyncReport; more: boolean };

  try {
    result = await step(link, {
      confirmRemovals,
      previous,
      failedLookups,
      deadline: Date.now() + lookupBudgetMs,
    });
  } catch (error) {
    // A refusal we wrote (an unshared sheet, a plan limit) is the message. Anything
    // else is ours to look at, and the owner gets the generic sentence.
    const ours = error instanceof RepositoryError || error instanceof ImportSourceError;
    if (!ours) console.error(`Sheet sync failed for map ${link.mapId}:`, error);

    result = {
      status: "failed",
      more: false,
      report: emptyReport(
        ours
          ? error.message
          : "Something broke on our side while syncing. Try again in a moment.",
      ),
    };
  }

  const saved = await recordSheetSync(link.id, result.status, result.report, failedLookups);

  return { ...result, link: saved };
}

async function step(
  link: SheetLink,
  {
    confirmRemovals,
    previous,
    failedLookups,
    deadline,
  }: {
    confirmRemovals: boolean;
    previous: SheetSyncReport | null;
    /** Mutated: new failures are added for `recordSheetSync` to store. */
    failedLookups: SheetLink["failedLookups"];
    deadline: number;
  },
): Promise<{ status: SheetSyncStatus; report: SheetSyncReport; more: boolean }> {
  const ctx = repoContext(link.userId);

  // Checked every step, not only when the link was made: an account that has
  // since dropped to Free keeps its link, and the link stops spending.
  const plan = await getUserPlan(link.userId);
  if (!planAllows(plan, "sheetSync")) {
    return {
      status: "failed",
      more: false,
      report: emptyReport(planFeatureMessage("sheetSync", plan)),
    };
  }

  const map = await getMap(ctx, link.mapId);

  const csv = await fetchGoogleSheetCsv({
    sheetId: link.sheetId,
    gid: link.gid ?? undefined,
    published: link.published,
  });

  const table = buildTable(readCsvText(csv, "Google Sheet"), link.headerRowIndex ?? "none");

  // A renamed or deleted column would otherwise read as every cell under it
  // going blank — names emptied, addresses cleared, every row reported broken.
  const missing = [...new Set(Object.values(link.mapping))].find(
    (header) => header && !table.headers.includes(header),
  );

  if (missing) {
    return {
      status: "failed",
      more: false,
      report: emptyReport(
        `The column "${missing}" is no longer in the sheet. Rename it back, or import the sheet again to link it afresh.`,
      ),
    };
  }

  const { rows, skipped: brokenRows } = usableSheetRows(
    buildDraftPlaces(table.rows, link.mapping).drafts,
  );

  const allPlaces = await listAllPlaces(ctx, map.id);
  const linked = allPlaces.filter(
    (place): place is Place & { sourceKey: string } => Boolean(place.sourceKey),
  );

  const diff = diffSheet(linked, rows);

  if (
    !confirmRemovals &&
    removalsNeedConfirmation({
      removals: diff.removals.length,
      linkedCount: linked.length,
      incomingCount: rows.length,
    })
  ) {
    return {
      status: "needs_confirmation",
      more: false,
      report: {
        ...emptyReport(
          `This sync would remove ${diff.removals.length} of the ${linked.length} locations that came from the sheet. Check the sheet, or confirm to remove them.`,
        ),
        pendingRemovals: diff.removals.length,
        linkedCount: linked.length,
      },
    };
  }

  const skipped: SheetSyncSkip[] = [...brokenRows];
  const notes: string[] = [];
  let more = false;

  /* ---------------------------------------------------------------- *
   * Tags: the file's labels against the map's vocabulary, exactly as the
   * import resolves them (import-wizard.tsx) — main tag first, then the rest,
   * the second pass fed the first's output.
   * ---------------------------------------------------------------- */

  const involved = [
    ...diff.matches.map((match) => match.row.draft),
    ...diff.adds.map((add) => add.draft),
  ];

  const mainTags = resolveTags(
    involved.map((draft) => draft.categoryLabel),
    map.tagGroups,
    MAIN_TAG_GROUP_LABEL,
  );
  const tags = resolveTags(involved.flatMap((draft) => draft.tagLabels), mainTags.tagGroups);
  const addedTags = mainTags.addedCount + tags.addedCount;

  const tagIdsFor = (draft: DraftPlace): string[] => [
    ...new Set(
      [
        mainTags.idByLabel.get(normalizeLabel(draft.categoryLabel)),
        ...draft.tagLabels.map((label) => tags.idByLabel.get(normalizeLabel(label))),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  /* ---------------------------------------------------------------- *
   * What each matched row changes. Bounded per step; the rest is next step's.
   * ---------------------------------------------------------------- */

  const plannedUpdates = diff.matches
    .map(({ place, row }) => ({
      place,
      row,
      ...sheetPatch(place, row, link.mapping, tagIdsFor(row.draft)),
    }))
    .filter(({ patch, needsGeocode }) => needsGeocode || !isEmptyPatch(patch));

  const updatesThisStep = plannedUpdates.slice(0, MAX_UPDATES_PER_STEP);
  if (plannedUpdates.length > updatesThisStep.length) more = true;

  /* ---------------------------------------------------------------- *
   * New rows, cut to what the plan has room for *before* anything is looked
   * up — geocoding a row that cannot be saved is spend for nothing.
   * ---------------------------------------------------------------- */

  const limit = PLAN_LIMITS[plan].places;
  const room = Math.max(limit - (allPlaces.length - diff.removals.length), 0);

  const addsInRoom = [
    ...diff.adds.filter((add) => add.draft.lat !== null),
    ...diff.adds.filter((add) => add.draft.lat === null),
  ].slice(0, room);

  const overLimit = diff.adds.length - addsInRoom.length;

  if (overLimit > 0) {
    notes.push(
      `Your ${plan} plan is full at ${limit} locations, so ${overLimit} new ${
        overLimit === 1 ? "row wasn't" : "rows weren't"
      } added. Upgrade, or remove some locations.`,
    );
  }

  const addsThisStep = addsInRoom.slice(0, MAX_CREATES_PER_STEP);
  if (addsInRoom.length > addsThisStep.length) more = true;

  /* ---------------------------------------------------------------- *
   * Address lookups, one per distinct address, inside the budget.
   * ---------------------------------------------------------------- */

  const lookups = await lookUpAddresses(
    link.userId,
    [
      ...updatesThisStep
        .filter((update) => update.needsGeocode)
        .map((update) => update.row.draft.address),
      ...addsThisStep
        .filter((add) => add.draft.lat === null)
        .map((add) => add.draft.address),
    ],
    deadline,
    failedLookups,
  );

  if (lookups.timedOut) more = true;

  if (lookups.stoppedEarly) {
    notes.push(
      "The address lookup stopped answering, so some rows weren't placed. The next sync tries them again.",
    );
  }

  /*
   * The allowance, not the engine. Its own note because the remedy is different —
   * waiting is the answer to one and upgrading may be the answer to the other —
   * and the sentence comes from the repository that knows which.
   */
  if (lookups.ranOut) {
    notes.push(`${lookups.ranOut} The next sync tries these rows again.`);
  }

  const answerFor = (address: string) => lookups.answers.get(normalizeAddress(address));

  const updates: { placeId: string; patch: SheetPlacePatch }[] = [];

  for (const { place, row, patch, needsGeocode } of updatesThisStep) {
    if (!needsGeocode) {
      updates.push({ placeId: place.id, patch });
      continue;
    }

    const answer = answerFor(row.draft.address);

    if (answer?.status === "ok" && answer.candidate) {
      updates.push({
        placeId: place.id,
        patch: {
          ...patch,
          lat: answer.candidate.lat,
          lng: answer.candidate.lng,
          geocodeStatus: "ok",
          geocodeConfidence: answer.candidate.confidence,
        },
      });
      continue;
    }

    // Not placed with confidence (or not reached yet): everything else about
    // the row still applies, and the location keeps its old address and pin.
    // Leaving the old address stored is also what makes a later step try again.
    const rest = { ...patch };
    delete rest.address;
    if (!isEmptyPatch(rest)) updates.push({ placeId: place.id, patch: rest });

    if (answer) {
      skipped.push({
        row: row.draft.rowNumber,
        name: row.draft.name,
        reason: `We couldn't place the new address "${row.draft.address}" with confidence, so this location kept its old one. Make the address more specific in the sheet.`,
      });
    }
  }

  const creates: CreatePlaceInput[] = [];

  for (const add of addsThisStep) {
    const placed = placeDraft(add, answerFor(add.draft.address));

    if (placed === null) continue;

    if ("reason" in placed) {
      skipped.push({ row: add.draft.rowNumber, name: add.draft.name, reason: placed.reason });
      continue;
    }

    const parsed = createPlaceSchema.safeParse({
      ...draftToCreateInput(placed.draft, tagIdsFor(placed.draft)),
      sourceKey: add.key,
    });

    if (!parsed.success) {
      skipped.push({
        row: add.draft.rowNumber,
        name: add.draft.name,
        reason: parsed.error.issues[0]?.message ?? "This row couldn't be saved.",
      });
      continue;
    }

    creates.push(parsed.data);
  }

  /* ---------------------------------------------------------------- *
   * Writes. Removals first, so the room they free is there for the adds.
   * ---------------------------------------------------------------- */

  if (diff.removals.length > 0) {
    await deletePlacesById(
      ctx,
      map.id,
      diff.removals.map((place) => place.id),
    );
  }

  // Before the places that wear them, so no location is ever saved naming a
  // tag the map does not define yet.
  if (addedTags > 0 && (updates.length > 0 || creates.length > 0)) {
    await updateMap(ctx, map.id, { tagGroups: tags.tagGroups });
  }

  await applySheetPatches(ctx, map.id, updates);

  if (creates.length > 0) await createPlaces(ctx, map.id, creates);

  const stepReport: SheetSyncReport = {
    added: creates.length,
    updated: updates.filter(({ patch }) =>
      Object.keys(patch).some((key) => key !== "sourceKey"),
    ).length,
    removed: diff.removals.length,
    skipped: skipped.slice(0, MAX_REPORTED_SKIPS),
    skippedTotal: skipped.length,
    republished: false,
  };

  const report = previous ? mergeStepReports(previous, stepReport) : stepReport;

  if (more) {
    return {
      status: "partial",
      more: true,
      report: {
        ...report,
        message:
          "Not every change from the sheet is in yet. Sync again to finish, or the daily sync will.",
      },
    };
  }

  /* ---------------------------------------------------------------- *
   * The last step republishes, when the map is live and the sync — this
   * step or an earlier one — changed something a visitor sees.
   * ---------------------------------------------------------------- */

  if (map.publishedAt && reportChangedMap(report)) {
    try {
      // The configured origin: the daily job has no request to read one from.
      await publishMap(ctx, map.id, env.appUrl);
      report.republished = true;
    } catch (error) {
      console.error(`Sheet sync could not republish map ${map.id}:`, error);
      notes.push(
        "Your locations are up to date, but the live map couldn't be republished. Publish it from the Publish tab.",
      );
    }
  }

  return {
    status: notes.length > 0 ? "partial" : "ok",
    more: false,
    report: notes.length > 0 ? { ...report, message: notes.join(" ") } : report,
  };
}

type LookupAnswer = { candidate: GeocodeCandidate | null; status: "ok" | "low" | "failed" };

/**
 * A new row's position: from the sheet, from a lookup, a reason it has none,
 * or null when its address was not reached this step.
 */
function placeDraft(
  add: SheetRow,
  answer: LookupAnswer | undefined,
): { draft: DraftPlace } | { reason: string } | null {
  const { draft } = add;

  if (draft.lat !== null && draft.lng !== null) return { draft };
  if (!answer) return null;

  if (answer.status !== "ok" || !answer.candidate) {
    return {
      reason:
        answer.status === "low"
          ? "Only a rough match for this address. Make it more specific in the sheet, or add latitude and longitude columns."
          : "We couldn't find this address. Check it in the sheet, or add latitude and longitude columns.",
    };
  }

  return {
    draft: {
      ...draft,
      lat: answer.candidate.lat,
      lng: answer.candidate.lng,
      status: "ok",
      confidence: answer.candidate.confidence,
    },
  };
}

/** Three failures in a row is an outage, not three bad addresses. */
const MAX_CONSECUTIVE_FAILURES = 3;

type LookupOutcome = {
  answers: Map<string, LookupAnswer>;
  stoppedEarly: boolean;
  timedOut: boolean;
  /**
   * Why the allowance stopped this step, if it did — already a finished sentence
   * for the report, because the two things that can stop it say different things
   * and only the repository knows which.
   */
  ranOut: string | null;
};

/**
 * One lookup per distinct address, in order, until the deadline or the allowance.
 *
 * Folded on `normalizeAddress`, the import's own rule for "the same question",
 * so a sheet with twenty rows at one retail park costs one request. An address
 * in `failedLookups` is answered from there without asking, and a new failure
 * is added to it — which is what stops one unfindable address costing a request
 * on every step of every day.
 *
 * **Metered as `background`, which is the whole reason the spend classes exist.**
 * Nobody is watching a nightly sync, and a "Sync now" press is somebody watching a
 * job they know is long — neither is owed the last of the day's shared budget
 * ahead of a person typing an address into a form. So this stands aside at the
 * reserve, and the step ends the way it already ends when the geocoder goes quiet:
 * a note, no error, and the rows tried again next time.
 *
 * Measured before the meter existed, one press of "Sync now" could walk 300 steps
 * at roughly 22 lookups each — about 6,600 requests, with nothing counting the
 * presses. That is what this bounds.
 */
async function lookUpAddresses(
  userId: string,
  addresses: string[],
  deadline: number,
  failedLookups: SheetLink["failedLookups"],
): Promise<LookupOutcome> {
  const answers = new Map<string, LookupAnswer>();
  const toAsk = new Map<string, string>();

  for (const address of addresses) {
    const key = normalizeAddress(address);
    if (!key || answers.has(key) || toAsk.has(key)) continue;

    const remembered = failedLookups[hash(key)];

    if (remembered) answers.set(key, { candidate: null, status: remembered.status });
    else toAsk.set(key, address);
  }

  const settled = { answers, stoppedEarly: false, timedOut: false, ranOut: null };

  if (toAsk.size === 0) return settled;

  try {
    await assertLookupHeadroom(userId, toAsk.size, "background");
  } catch (error) {
    /*
     * All or nothing for this step, rather than asking for whatever still fits.
     * Partial progress is already the normal shape here — a step that times out
     * leaves rows for the next one — so stopping cleanly and saying why beats
     * dribbling out the last of an allowance a few addresses at a time, which
     * would leave a sheet half-placed with no obvious reason.
     */
    if (error instanceof RepositoryError) {
      return { ...settled, ranOut: error.message };
    }

    throw error;
  }

  const geocoder = getGeocoder();
  let failures = 0;
  let spent = 0;

  try {
    for (const [key, address] of toAsk) {
      if (Date.now() > deadline) return { ...settled, timedOut: true };

      try {
        const [best = null] = await geocoder.search({ address, limit: 1 });
        spent += 1;

        const status = statusFor(best);

        answers.set(key, { candidate: best, status });
        failures = 0;

        if (status !== "ok") {
          failedLookups[hash(key)] = { at: new Date().toISOString(), status };
        }
      } catch (error) {
        failures += 1;

        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          console.error("Sheet sync: address lookup stopped answering:", error);
          return { ...settled, stoppedEarly: true };
        }
      }
    }

    return settled;
  } finally {
    /*
     * In a `finally` because this function has five exits and every one of them
     * has already spent what it spent. A `return` inside the loop that skipped
     * the count would make the cheapest way to use the geocoder be to fail
     * halfway through.
     */
    await recordLookups(userId, spent);
  }
}

function emptyReport(message?: string): SheetSyncReport {
  return {
    added: 0,
    updated: 0,
    removed: 0,
    skipped: [],
    skippedTotal: 0,
    republished: false,
    ...(message ? { message } : {}),
  };
}
