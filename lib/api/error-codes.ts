/**
 * The closed set of error codes our API can return. Shared by the route handlers
 * that emit them and the client fetcher that reads them, so a typo is a type error.
 */
export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "validation_failed",
  "plan_limit_reached",
  "conflict",
  "rate_limited",
  "internal_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Field-level messages, keyed by form field name. */
export type ApiFieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: ApiFieldErrors;
  };
};
