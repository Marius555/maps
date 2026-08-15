"use client";

import { Toast } from "@heroui/react";

import { SM_BREAKPOINT, useMediaQuery } from "@/lib/ui/use-media-query";

/**
 * Where toasts appear, and what they look like.
 *
 * **Placement is responsive, and it is a prop rather than a keyframe.** HeroUI
 * ships the entrance for each placement as a CSS view transition, so asking for
 * `top` on a phone gets a card that comes down from the top of the screen, and
 * `bottom end` on a desktop gets one that rises into the corner. Writing our own
 * animation would be re-deriving something the stylesheet already has, and doing
 * it in a way the blanket `prefers-reduced-motion` rule could not reach.
 *
 * Bottom-right is right on a wide screen because nothing lives there. It is wrong
 * on a phone, where the bottom of the screen is the thumb, the browser chrome and
 * — in this app — the map's own controls.
 *
 * **This is a component of its own rather than three lines inside AppProviders,
 * and that is not tidiness.** AppProviders wraps `{children}`, which is every
 * page in the app. Subscribing it to a media query would re-render the entire
 * tree each time the viewport crossed 40rem, to move a box that is usually not
 * on screen.
 *
 * `useMediaQuery` answers false on the server, so the first client render picks
 * the phone placement before settling. Nothing sees it: the region draws nothing
 * at all until a toast is queued.
 *
 * **The `children` render prop replaces HeroUI's default toast.** It still runs
 * inside the provider's own context, so the compound parts keep their slots,
 * their stacking, and the height measurement that lets several toasts sit behind
 * each other. What changes is the composition: an indicator that is a filled,
 * tinted circle rather than a loose glyph, a title with enough weight to be read
 * first, and a description set to wrap evenly under it. A plan limit is not a
 * "something went wrong" — it is a sentence the user has to actually read, and
 * the default toast's job is to be ignorable.
 */
export function ToastRegion() {
  const isWide = useMediaQuery(SM_BREAKPOINT);

  return (
    <Toast.Provider
      placement={isWide ? "bottom end" : "top"}
      width={380}
      maxVisibleToasts={3}
    >
      {({ toast: queued }) => {
        const { actionProps, description, indicator, title, variant } =
          queued.content ?? {};

        const action = actionProps?.children ? (
          <Toast.ActionButton size="sm" variant="secondary" {...actionProps} />
        ) : null;

        return (
          <Toast toast={queued} variant={variant} className="items-center gap-3">
            {/*
             * A filled circle rather than a loose glyph, and round rather than
             * squared: HeroUI's toast carries a 32px corner radius, so at this
             * height it is very nearly a pill, and a rounded rectangle sitting
             * inside one reads as a mistake. Undefined children fall through to
             * the variant's own icon, which is why nothing is passed for it.
             */}
            <Toast.Indicator
              variant={variant}
              className={`grid size-8 shrink-0 place-items-center rounded-full p-0 ${tintClass(variant)}`}
            >
              {indicator}
            </Toast.Indicator>

            <Toast.Content className="gap-0.5">
              {title ? (
                <Toast.Title className="font-semibold">{title}</Toast.Title>
              ) : null}
              {description ? (
                <Toast.Description className="text-pretty">
                  {description}
                </Toast.Description>
              ) : null}

              {/* Under the text on a phone, beside it on a desktop — the same
                  split HeroUI's own default makes, for the same reason: at
                  `100vw - 2rem` a button on the end leaves the sentence about
                  150px to wrap in. */}
              {isWide ? null : action}
            </Toast.Content>

            {isWide ? action : null}

            <Toast.CloseButton />
          </Toast>
        );
      }}
    </Toast.Provider>
  );
}

/**
 * The variants are a closed set in HeroUI's own types, and this is written out
 * rather than interpolated because Tailwind reads class names as text — a
 * `bg-${variant}/10` would compile to nothing at all.
 */
function tintClass(variant: string | undefined): string {
  switch (variant) {
    case "danger":
      return "bg-danger/10 text-danger";
    case "warning":
      return "bg-warning/10 text-warning";
    case "success":
      return "bg-success/10 text-success";
    case "accent":
      return "bg-accent/10 text-accent";
    default:
      return "bg-default text-muted";
  }
}
