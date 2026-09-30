"use client";

import dynamic from "next/dynamic";

import { retryImport } from "@/lib/ui/retry-import";

/**
 * The console's own charts, kept off the server render for the reason
 * `components/analytics/charts/lazy.tsx` gives: recharts sizes itself from a
 * measured box. The caller's box owns the height, so nothing moves when a
 * chart arrives.
 */
const none = () => null;

export const LazyTrendAreaChart = dynamic(
  retryImport(() => import("./trend-area-chart").then((m) => ({ default: m.TrendAreaChart }))),
  { ssr: false, loading: none },
);

export const LazyStackedDaysChart = dynamic(
  retryImport(() => import("./stacked-days-chart").then((m) => ({ default: m.StackedDaysChart }))),
  { ssr: false, loading: none },
);
