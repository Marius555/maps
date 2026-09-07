import type {
  ApiErrorBody,
  ApiErrorCode,
  ApiFieldErrors,
} from "@/lib/api/error-codes";

/**
 * A failed API call, carrying the server's own message.
 *
 * The client never composes error copy — CLAUDE.md §8's rules are applied once,
 * on the server, and rendered verbatim here.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: ApiFieldErrors,
    /**
     * What the server's own `Retry-After` said, in milliseconds, when it sent
     * one. Undefined otherwise — a caller that wants to retry then picks its own
     * backoff rather than inventing a number and calling it the server's.
     */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  return unwrap<T>(response);
}

/**
 * Multipart upload.
 *
 * Separate from apiFetch because the content-type must be left unset: the browser
 * generates it along with the multipart boundary, and overriding it makes the
 * body unparseable on the server.
 */
export async function apiUpload<T>(
  path: string,
  body: FormData,
  init?: Omit<RequestInit, "body">,
): Promise<T> {
  const response = await fetch(path, { method: "POST", ...init, body });

  return unwrap<T>(response);
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      error?.code ?? "internal_error",
      error?.message ?? "Something broke on our side. Try again in a moment.",
      response.status,
      error?.fields,
      retryAfterMs(response),
    );
  }

  return (body as { data: T }).data;
}

/**
 * `Retry-After`, in milliseconds, when the header is a plain number of seconds.
 *
 * The HTTP-date form is legal and deliberately not read: it needs the client's
 * clock to agree with the server's, and a skewed clock turns "wait two seconds"
 * into "wait an hour" or into no wait at all. An unreadable header is simply
 * absent, and the caller falls back to its own backoff.
 */
function retryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;

  const seconds = Number(raw.trim());
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;

  return seconds * 1000;
}
