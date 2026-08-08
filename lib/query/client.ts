import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./fetcher";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Retrying a 401 or a plan limit just delays the message the user needs.
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        // Never silently retry a create — a dropped pin would land twice.
        retry: 0,
      },
    },
  });
}
