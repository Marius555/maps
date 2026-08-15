"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";

import { makeQueryClient } from "@/lib/query/client";
import { ToastRegion } from "./toast-region";

/**
 * HeroUI v3 needs no provider of its own — it is React Aria plus CSS variables.
 * Toast is the exception: it renders into a queue that has to be mounted once.
 * `ToastRegion` is that mount, kept in its own file so the media query it watches
 * cannot re-render everything under `{children}`.
 *
 * The query client is created in state, not as a module singleton, so an SSR
 * render never shares one user's cache with the next request's.
 *
 * `MotionConfig reducedMotion="user"` is the JS half of §8's "respect
 * prefers-reduced-motion everywhere". The CSS half is the blanket rule in
 * globals.css; that one cannot reach Motion's animations, because they are
 * driven by inline transforms rather than transitions.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  /*
   * Arms the theme cross-fade, once, after the first paint.
   *
   * globals.css transitions the registered colour tokens on
   * `:root[data-theme-ready]`. Setting the attribute here rather than in the
   * pre-paint script is the whole point: the script's job is to apply the stored
   * theme *without* it being seen, and a live transition at that moment would
   * animate exactly the change it is hiding.
   */
  useEffect(() => {
    document.documentElement.dataset.themeReady = "";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        {children}
        <ToastRegion />
      </MotionConfig>
    </QueryClientProvider>
  );
}
