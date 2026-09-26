import { Reveal } from "../reveal";

export type Point = {
  symbol: React.ReactNode;
  title: string;
  body: string;
};

/**
 * A short run of points set the way the key sets its entries: a drawn symbol,
 * a title, one line. Used beside a drawing, so it is one column at every width.
 */
export function PointList({ points }: { points: readonly Point[] }) {
  return (
    <ul className="grid gap-4 lg:gap-5">
      {points.map((point, index) => (
        <li key={point.title}>
          {/* Reveal inside the <li>: a <ul> may only have <li> children. */}
          <Reveal className="flex gap-4" delay={Math.min(index, 3) * 0.05}>
            <span className="mt-0.5">{point.symbol}</span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {point.title}
              </h3>
              <p className="mt-1 text-sm/5.5 text-pretty text-muted">{point.body}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
