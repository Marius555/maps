"use client";

import { Toast } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { makeQueryClient } from "@/lib/query/client";

/**
 * HeroUI v3 needs no provider of its own — it is React Aria plus CSS variables.
 * Toast is the exception: it renders into a queue that has to be mounted once.
 *
 * The query client is created in state, not as a module singleton, so an SSR
 * render never shares one user's cache with the next request's.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toast.Provider placement="bottom end" />
    </QueryClientProvider>
  );
}
