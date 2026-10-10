"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ConnectedMap } from "@/lib/connect/wordpress";
import type { ConnectMapInput } from "@/lib/validation/connect.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

export type ConnectResult = {
  map: ConnectedMap;
  published: boolean;
  siteRefused: boolean;
};

/** `POST /api/connect/wordpress` — `app/api/connect/wordpress/route.ts`. */
export function useConnectWordPress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConnectMapInput) =>
      apiFetch<ConnectResult>("/api/connect/wordpress", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // It may have created a map, or published or re-allowed one.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.maps.all }),
  });
}
