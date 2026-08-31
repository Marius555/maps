"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { GeocodeResultList } from "@/components/geocode/geocode-result-list";
import { PlanLimitNote } from "@/components/map/plan-limit-note";
import { ErrorMessage } from "@/components/ui/error-message";
import { IconButton } from "@/components/ui/icon-button";
import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { isAtLimit, type PlanHeadroom } from "@/lib/map/plan-headroom";
import { useGeocodeSearch } from "@/lib/query/geocode";

const MIN_QUERY = 3;

/**
 * Find an address on the map.
 *
 * This is the editor's own search, and it geocodes — which the embed's search
 * deliberately does not. The difference is CLAUDE.md §2: the embed runs in a
 * visitor's browser, where a metered lookup per keystroke is the business model
 * broken, while this runs in the dashboard for the map's owner. So the box in the
 * preview filters the map's own locations, and this one finds places on Earth.
 * They look similar and are not the same control.
 *
 * Picking a result moves the camera. The `+` beside it creates a location at that
 * exact match — which is also the keyboard route to adding one, now that "Add at
 * centre" is gone; clicking the map and dragging a pin out of the toolbar are
 * both pointer-only, and §8's quality floor asks for a form usable with a
 * keyboard alone.
 *
 * It lives *inside* the toolbar panel and spends most of its life as an icon, so
 * a map editor is not permanently paying a 288px strip of its map for a control
 * used a few times a session. Opening it borrows that width from the add
 * control's label, which folds away — see `data-search-open` below.
 *
 * The one rule the folding obeys: a search in progress is never interrupted by
 * the bar reshaping itself. `isHolding` is the whole of it — a request in
 * flight, a list of matches, or an error all pin the bar open however focus
 * moves, because every one of them is something the user is still reading or
 * waiting for. Only an empty, idle bar folds on its own.
 *
 * ## Why the whole control is always mounted
 *
 * The first version of this swapped between an icon button and a different tree,
 * grew the field with a Motion animation, and let the toolbar panel wrap. That
 * flickered badly: the field claimed a `flex-basis` before it had any width, the
 * label was still unfolded, and the panel resolved the overflow by breaking onto
 * a second row for the length of the fold and then snapping back.
 *
 * So: nothing here mounts or unmounts on toggle, the panel cannot wrap, and every
 * width that moves is a CSS `max-width` transition on the same two tokens. Opening
 * and closing are then one layout pass per frame with no discrete steps anywhere —
 * which is the only way this reads as one control changing shape rather than
 * several arriving at once. `prefers-reduced-motion` is covered by the blanket
 * rule in globals.css, which zeroes transition durations.
 */
export function MapSearch({
  mapId,
  headroom,
  onPick,
  onAdd,
}: {
  mapId: string;
  /**
   * The location allowance. The `+` is the third way to add one — beside the
   * pin grid and the drag — so it greys with them; searching itself never does,
   * because moving the camera to an address costs no location.
   */
  headroom?: PlanHeadroom;
  onPick: (candidate: GeocodeCandidate) => void;
  onAdd: (candidate: GeocodeCandidate) => void;
}) {
  const search = useGeocodeSearch(mapId);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isTooShort = query.trim().length < MIN_QUERY;
  /** Anything the user would lose if the bar folded right now. */
  const isHolding = search.isPending || candidates !== null || search.error !== null;

  const isFull = headroom ? isAtLimit(headroom) : false;
  const noteId = useId();

  // Opening puts the caret in the field. An effect rather than `autoFocus`,
  // because the input is never remounted — and it has to run after the commit
  // that drops `inert`, since focus does not land on inert content.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const run = async () => {
    if (isTooShort) return;

    try {
      setCandidates(await search.mutateAsync({ address: query }));
    } catch {
      // Rendered from the mutation's error below.
    }
  };

  // Clearing empties the bar but does not put it away: focus goes back to the
  // field so the next query can just be typed. Pressing X to start again and
  // having the control vanish under the pointer would be a control fighting you.
  // It also matters mechanically — clearing is what makes `isHolding` false, and
  // without the focus the blur that follows would fold the bar on the spot.
  const clear = () => {
    setQuery("");
    setCandidates(null);
    search.reset();
    inputRef.current?.focus();
  };

  // Folding takes the field's focus with it, so hand it back to the button that
  // opened the bar rather than letting `inert` drop it on the body.
  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    /*
     * One element wraps the field *and* the results, because the focus-out check
     * below is `contains()` — a match row is inside the search, so tabbing onto
     * one must not read as leaving it.
     *
     * `data-search-open` is how the toolbar knows to fold the add control's
     * label. A CSS `group-has-` on the panel rather than state lifted into
     * MapToolbar and handed back down: the open bar is this component's own
     * business, and there is nothing else for the toolbar to do with it. It also
     * means the label and the field fold on one clock — both are CSS transitions
     * off the same attribute appearing, in the same frame.
     *
     * No `flex-1` and no `basis-*`: the row must take exactly the width its
     * children currently have, which during the transition is a moving number.
     * A flex-basis would reserve its full width in the first frame and undo the
     * animation before it started. `min-w-0` is all that is needed to shrink.
     *
     * No `gap` either — a gap is not clipped by the field's `overflow-hidden`,
     * so it would survive the fold and leave the collapsed control 4px wider
     * than the icon buttons beside it. The input's own `px-3` is the spacing.
     */
    <div
      data-search-open={isOpen ? "" : undefined}
      className="relative flex min-w-0 items-center"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        if (isHolding) return;

        setIsOpen(false);
      }}
      // Escape belongs to the whole control, not to the text box: by the time
      // there is something to escape *from*, focus is as likely to be on a match
      // in the list as in the field.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;

        event.preventDefault();
        // The editor listens for Escape on the window to leave add mode. In here
        // Escape is about the search, and should not do both.
        event.stopPropagation();

        // Two stages, because there are two things to back out of: first the
        // matches, then the bar itself.
        if (isHolding) {
          clear();
          return;
        }

        close();
      }}
    >
      {/*
       * Opening the search and running it are the same button, because they were
       * always the same glyph in the same place — two elements swapping over
       * would be a remount, and a remount is a jump.
       *
       * It leads rather than trails so that the control under the pointer stays
       * put while the field unrolls to its right.
       *
       * Not disabled below MIN_QUERY: the press that opens the bar would then
       * grey it out on the way in, which is a state flash on the thing just
       * clicked. `run` already ignores a short query, exactly as Enter does.
       */}
      <IconButton
        ref={triggerRef}
        label="Find an address"
        icon={Search}
        placement="bottom"
        isPending={search.isPending}
        onPress={() => {
          if (isOpen) void run();
          else setIsOpen(true);
        }}
      />

      {/*
       * The field is clipped to nothing rather than removed. `w-72` is its
       * resting width; `max-w-0` takes its contribution to the panel's width to
       * zero without taking it out of the DOM, so opening and closing are the
       * same transition run in opposite directions. `inert` is what keeps a
       * field nobody can see out of the tab order and the accessibility tree.
       */}
      <div
        inert={!isOpen}
        className={`relative flex w-72 min-w-0 items-center overflow-hidden transition-[max-width,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out-fluid)] ${
          isOpen ? "max-w-72 opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        <TextField
          fullWidth
          aria-label="Find an address"
          value={query}
          onChange={setQuery}
          // Enter submits the search rather than the page. This panel is not
          // inside a form today, and it must not start behaving differently if
          // one is ever wrapped around it. Escape is handled on the root above.
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;

            event.preventDefault();
            void run();
          }}
        >
          {/* Visually hidden: the placeholder and the icon already say what the
              field is, and a label above it would double the toolbar's height. */}
          <Label className="sr-only">Find an address</Label>
          {/*
           * Sized to `.button--sm`, not to HeroUI's own input padding — this sits
           * in a row of toolbar buttons, and a field 4px taller than its
           * neighbours makes the panel a rectangle with a step in it.
           *
           * The focus ring is inset because the wrapper above clips: an outer
           * ring is a box-shadow, and `overflow-hidden` would cut it off. Same
           * idiom as the geocode result rows and the locations list.
           */}
          <Input
            ref={inputRef}
            placeholder="Find an address"
            // `pe-8` is the room Clear sits in — see below. Padding rather than
            // a sibling's width, so the text simply stops short of the button
            // instead of the field stopping short of it.
            className="h-9 border-0 bg-transparent py-0 pe-8 text-sm shadow-none focus:inset-ring-2 focus:inset-ring-focus focus:ring-0 data-focused:inset-ring-2 data-focused:inset-ring-focus data-focused:ring-0 md:h-8"
          />
        </TextField>

        {/*
         * Clear sits *in* the field, at its trailing end, rather than beside it.
         *
         * It was a flex sibling of the TextField, and a sibling has a width
         * whether or not it can be seen: an idle search bar spent about 32px of
         * a 288px field on a button that was `opacity-0`, which read as the text
         * mysteriously stopping short of the end. Now it is absolutely
         * positioned over the `pe-8` the input reserves for it, so an empty bar
         * is all field and nothing moves when the first keystroke fades it in.
         *
         * Absolute rather than HeroUI's own `InputGroup.Suffix`, which is the
         * built-in shape for this and brings a divider rule, its own padding and
         * a focus ring around the whole group — three things this field has
         * already been carefully talked out of, because it has to stand exactly
         * `.button--sm` tall in a row of toolbar buttons.
         *
         * `inert` while empty is what keeps a button nobody can see out of the
         * tab order; it was already doing that job and still is.
         */}
        <Button
          size="sm"
          variant="tertiary"
          aria-label="Clear search"
          isIconOnly
          inert={!query}
          className={`absolute end-1 top-1/2 size-6 min-w-0 -translate-y-1/2 rounded-md transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out-fluid)] ${
            query ? "opacity-100" : "opacity-0"
          }`}
          onPress={clear}
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>

      {/*
       * Results hang below the toolbar on their own surface rather than inside
       * it, so a long list scrolls instead of growing the panel down over the
       * map. Absolute, and outside the clipping wrapper above: it is anchored to
       * the bar but is not part of its geometry. Capped, because five matches on
       * a short map panel is most of it.
       */}
      {search.error || candidates ? (
        <div className="absolute top-full right-0 z-20 mt-2 max-h-64 w-72 max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-sm">
          {search.error ? <ErrorMessage error={search.error} /> : null}

          <GeocodeResultList
            candidates={candidates}
            emptyMessage="No matches. Try adding a city or postcode."
            /*
             * A `+` the size of the line it sits on, not a button beside the
             * match. "Add here" was a word-and-a-half of chrome taking a third
             * of a 288px panel away from the address, which is the one thing
             * the row exists to show. The hit area is padded back out to a
             * comfortable size with a transparent `::after`, so shrinking the
             * control does not shrink the target (§8).
             */
            action={(candidate) => (
              <IconButton
                label="Add a location here"
                icon={Plus}
                variant="primary"
                iconClassName="size-3"
                className="relative size-4 min-w-0 rounded-md p-0 after:absolute after:-inset-2 after:content-['']"
                isDisabled={isFull}
                aria-describedby={isFull ? noteId : undefined}
                onPress={() => {
                  onAdd(candidate);
                  clear();
                }}
              />
            )}
            // Picking flies the camera and leaves the list up: the next match is
            // one click away, and a list that closed on the first guess would
            // make comparing two of them a second search.
            onPick={onPick}
          />

          {/*
           * Why every `+` above is grey.
           *
           * A line under the list rather than a tooltip on the button. The
           * `IconButton` wraps a React Aria `Button`, and React Aria does not
           * fire a tooltip for a disabled trigger — so the explanation would
           * exist only in markup nobody can reach. This is visible without
           * hovering, matches the two menus, and is the same sentence they use.
           *
           * Native `disabled` is right here, unlike the tiles and tool rows:
           * these buttons are one per result in a list that also has its own
           * `onPick` on every row, so the reason is reachable by keyboard
           * through the row itself and there is nothing stranded.
           */}
          {isFull && headroom ? (
            <PlanLimitNote id={noteId} resource="places" headroom={headroom} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
