/**
 * An in-memory stand-in for Appwrite's `tablesDB`, for repository tests that
 * need more than one table to agree — the team tables, where an invite, the
 * members it counts and the plan it is counted against are three tables read
 * in one decision.
 *
 * It understands the queries the repositories actually send — `equal`,
 * `greaterThan`, `orderAsc`/`orderDesc`, `limit` — and the unique indexes a test
 * declares, answering a collision the way Appwrite does: an exception with code
 * 409. Anything else it is handed is ignored rather than guessed at, so a
 * repository that starts relying on a new query fails its test loudly by
 * returning the wrong rows.
 *
 * Errors carry `code` and are real `AppwriteException`s, because
 * `lib/appwrite/errors.ts` decides 404 and 409 with `instanceof`.
 */

import { AppwriteException } from "node-appwrite";

type Row = Record<string, unknown> & { $id: string; $createdAt: string; $updatedAt: string };

type Query = { method: string; attribute?: string; values?: unknown[] };

export type FakeTables = ReturnType<typeof createFakeTables>;

export function createFakeTables(unique: Record<string, string[][]> = {}) {
  const tables = new Map<string, Row[]>();
  let clock = Date.parse("2026-10-01T00:00:00.000Z");
  let sequence = 0;

  const rowsOf = (tableId: string): Row[] => {
    if (!tables.has(tableId)) tables.set(tableId, []);
    return tables.get(tableId)!;
  };

  const nextTime = (): string => {
    clock += 1000;
    return new Date(clock).toISOString();
  };

  const matches = (row: Row, queries: Query[]): boolean =>
    queries.every((query) => {
      const value = query.attribute ? row[query.attribute] : undefined;

      switch (query.method) {
        case "equal":
          return (query.values ?? []).some((candidate) => candidate === value);
        case "greaterThan":
          return String(value) > String(query.values?.[0]);
        default:
          return true;
      }
    });

  const collides = (tableId: string, data: Record<string, unknown>, except?: string) =>
    (unique[tableId] ?? []).some((columns) =>
      rowsOf(tableId).some(
        (row) =>
          row.$id !== except && columns.every((column) => row[column] === data[column]),
      ),
    );

  const parse = (queries: string[] | undefined): Query[] =>
    (queries ?? []).map((raw) => JSON.parse(raw) as Query);

  const api = {
    async listRows({ tableId, queries }: { tableId: string; queries?: string[] }) {
      const parsed = parse(queries);
      let rows = rowsOf(tableId).filter((row) => matches(row, parsed));

      for (const query of parsed) {
        if (query.method === "orderAsc" || query.method === "orderDesc") {
          const key = query.attribute ?? "$id";
          const sign = query.method === "orderAsc" ? 1 : -1;
          rows = [...rows].sort((a, b) => sign * String(a[key]).localeCompare(String(b[key])));
        }
      }

      const total = rows.length;
      const limit = parsed.find((query) => query.method === "limit")?.values?.[0];

      if (typeof limit === "number") rows = rows.slice(0, limit);

      return { rows: rows.map((row) => ({ ...row })), total };
    },

    async getRow({ tableId, rowId }: { tableId: string; rowId: string }) {
      const row = rowsOf(tableId).find((candidate) => candidate.$id === rowId);
      if (!row) throw new AppwriteException("Row not found", 404);
      return { ...row };
    },

    async createRow({
      tableId,
      rowId,
      data,
    }: {
      tableId: string;
      rowId: string;
      data: Record<string, unknown>;
    }) {
      if (collides(tableId, data)) throw new AppwriteException("Conflict", 409);

      const now = nextTime();
      const row: Row = {
        ...data,
        $id: rowId === "unique()" ? `row-${String((sequence += 1))}` : rowId,
        $createdAt: now,
        $updatedAt: now,
      };

      rowsOf(tableId).push(row);
      return { ...row };
    },

    async updateRow({
      tableId,
      rowId,
      data,
    }: {
      tableId: string;
      rowId: string;
      data: Record<string, unknown>;
    }) {
      const row = rowsOf(tableId).find((candidate) => candidate.$id === rowId);
      if (!row) throw new AppwriteException("Row not found", 404);
      if (collides(tableId, { ...row, ...data }, rowId)) {
        throw new AppwriteException("Conflict", 409);
      }

      Object.assign(row, data, { $updatedAt: nextTime() });
      return { ...row };
    },

    async deleteRow({ tableId, rowId }: { tableId: string; rowId: string }) {
      const rows = rowsOf(tableId);
      const index = rows.findIndex((candidate) => candidate.$id === rowId);
      if (index < 0) throw new AppwriteException("Row not found", 404);
      rows.splice(index, 1);
    },

    async deleteRows({ tableId, queries }: { tableId: string; queries?: string[] }) {
      const parsed = parse(queries);
      tables.set(
        tableId,
        rowsOf(tableId).filter((row) => !matches(row, parsed)),
      );
    },
  };

  return {
    api,
    /** Every row in a table, as stored. */
    rows: (tableId: string) => rowsOf(tableId),
    /** Put rows in directly, with ids and creation times of the test's choosing. */
    seed(tableId: string, rows: Array<Record<string, unknown> & { $id: string }>) {
      for (const row of rows) {
        const now = (row.$createdAt as string | undefined) ?? nextTime();
        rowsOf(tableId).push({ $createdAt: now, $updatedAt: now, ...row } as Row);
      }
    },
  };
}
