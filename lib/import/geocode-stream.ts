import type { ApiErrorCode } from "@/lib/api/error-codes";
import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import { ApiError } from "@/lib/query/fetcher";

/**
 * The geocode batch's answer, one line at a time.
 *
 * The endpoint looks a chunk's addresses up one after another, and it used to
 * answer once, at the end — so a three-address file sat at "0 of 3" for the
 * whole request and then jumped to Review. Each answer is now written the moment
 * it is found, as newline-delimited JSON, and the progress bar moves per address.
 *
 * If anything between us and the browser buffers the response, every line simply
 * arrives at once, which is exactly the old behaviour. Streaming can only make
 * the bar move sooner, never break it.
 *
 * Three kinds of line, in this order:
 * - `{"result": …}` — one per row, as it is answered;
 * - `{"done": {"paceMs": n}}` — the chunk finished;
 * - `{"error": {…}}` — instead of `done`, when the geocoder failed partway. The
 *   results already sent stand; the caller retries only the rest.
 */
export type GeocodeStreamError = {
  code: ApiErrorCode;
  message: string;
  status: number;
  retryAfterMs?: number;
};

export type GeocodeStreamLine =
  | { result: BatchGeocodeResult }
  | { done: { paceMs: number } }
  | { error: GeocodeStreamError };

export const GEOCODE_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/**
 * Split what has arrived into whole lines, keeping the unfinished tail.
 *
 * A network chunk ends wherever it ends — often in the middle of a line — so the
 * tail is carried into the next call rather than parsed half-written.
 */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";

  return { lines: parts.filter((line) => line.trim() !== ""), rest };
}

/**
 * Read a streamed batch, handing each answer to `onResult` as it lands.
 *
 * Throws the same `ApiError` `apiFetch` would for a failure the server named,
 * and a plain error — no status, so the run treats it as a dropped connection
 * and retries — when the stream ends without saying it was done.
 */
export async function readGeocodeStream(
  response: Response,
  onResult: (result: BatchGeocodeResult) => void,
): Promise<{ paceMs?: number }> {
  if (!response.body) throw new Error("The address lookup sent nothing back.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const { lines, rest } = splitLines(done ? `${buffer}\n` : buffer);
    buffer = rest;

    for (const line of lines) {
      const parsed = JSON.parse(line) as GeocodeStreamLine;

      if ("result" in parsed) {
        onResult(parsed.result);
      } else if ("done" in parsed) {
        return { paceMs: parsed.done.paceMs };
      } else {
        const { code, message, status, retryAfterMs } = parsed.error;
        throw new ApiError(code, message, status, undefined, retryAfterMs);
      }
    }

    if (done) break;
  }

  throw new Error("The address lookup stopped partway. Trying again.");
}
