/**
 * Stands in for the `server-only` package under Vitest.
 *
 * The real package throws unless the bundler resolves it with React's
 * `react-server` condition, which Vitest doesn't set. Aliased in
 * vitest.config.mts so server modules can be unit tested; the real guard still
 * applies to every Next.js build, which is where it matters.
 */
export {};
