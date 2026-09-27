"use client";

import dynamic from "next/dynamic";

import { retryImport } from "@/lib/ui/retry-import";

/**
 * Every Analytics chart, kept off the server render.
 *
 * **`ssr: false` is forced rather than chosen.** Recharts sizes itself from a
 * measured box, so there is nothing for it to draw on the server, and
 * `ssr: false` is only legal inside a client module — which is why these calls
 * live in a file of their own rather than in the server-rendered cards that
 * place them. The landing page's `bill-chart-loader.tsx` has the same shape
 * for the same reason.
 *
 * **The caller's box owns the height.** Each chart fills its parent, and the
 * parent is sized from the server render on, so nothing below a chart moves
 * when recharts arrives. The loading state is therefore nothing at all: the
 * figures the chart draws are printed beside it already, and a spinner in a
 * box that is about to hold a picture of them is an interruption.
 *
 * `retryImport` keeps one failed chunk fetch from being fatal for the session —
 * see its own file.
 */
const none = () => null;

export const LazySparkline = dynamic(
  retryImport(() => import("./sparkline").then((m) => ({ default: m.Sparkline }))),
  { ssr: false, loading: none },
);

export const LazyTrafficChart = dynamic(
  retryImport(() =>
    import("./traffic-chart").then((m) => ({ default: m.TrafficChart })),
  ),
  { ssr: false, loading: none },
);

export const LazyDonutChart = dynamic(
  retryImport(() => import("./donut-chart").then((m) => ({ default: m.DonutChart }))),
  { ssr: false, loading: none },
);

export const LazyStackedBarChart = dynamic(
  retryImport(() =>
    import("./stacked-bar-chart").then((m) => ({ default: m.StackedBarChart })),
  ),
  { ssr: false, loading: none },
);

export const LazyBarListChart = dynamic(
  retryImport(() =>
    import("./bar-list-chart").then((m) => ({ default: m.BarListChart })),
  ),
  { ssr: false, loading: none },
);
