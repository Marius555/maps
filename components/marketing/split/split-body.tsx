import { Reveal } from "../reveal";
import { PointList, type Point } from "./point-list";

/**
 * A drawing on one side and the points it illustrates on the other.
 *
 * The drawing sits in a panel at its own 3:2, like the sequence's steps, so a
 * change of column width scales it rather than cropping a different bite out
 * of it. `artSide` alternates between neighbouring sections so two in a row do
 * not read as one section repeated. Below `lg` the drawing always comes first.
 */
export function SplitBody({
  art,
  points,
  artSide = "left",
}: {
  art: React.ReactNode;
  points: readonly Point[];
  artSide?: "left" | "right";
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <Reveal className={artSide === "right" ? "lg:order-last" : undefined}>
        <div className="mk-panel aspect-[3/2] w-full overflow-hidden rounded-2xl">{art}</div>
      </Reveal>

      <PointList points={points} />
    </div>
  );
}
