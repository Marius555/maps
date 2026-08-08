import { buttonVariants, type ButtonVariants } from "@heroui/react";
import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A Next.js Link that looks like a HeroUI Button.
 *
 * HeroUI's Button renders a real <button> (React Aria), so wrapping a Link
 * inside one produces invalid markup and loses prefetching. Reusing
 * `buttonVariants` keeps navigation semantics and the button's look.
 */
export function LinkButton({
  className,
  variant,
  size,
  fullWidth,
  ...props
}: ComponentProps<typeof Link> & ButtonVariants) {
  return (
    <Link
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
