/**
 * The size of the three buttons an auth page opens on — Google, GitHub and
 * Continue with email — so they read as one set.
 *
 * HeroUI's `lg` sets 16px text but only 40px of height on a desktop; the extra
 * class makes it 48px at every width, with a 20px mark. Both win because
 * @heroui/styles sits in `@layer components`, under Tailwind's utilities.
 * `>svg` rather than any svg, so a pending button's spinner keeps its own size.
 *
 * A plain module so a server component could import it too.
 */
export const AUTH_CHOICE_BUTTON = {
  size: "lg",
  className: "h-12 [&>svg]:size-5",
} as const;
