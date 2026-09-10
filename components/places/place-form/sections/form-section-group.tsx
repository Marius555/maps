"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { revealFoldIn } from "@/lib/ui/reveal-fold";

/**
 * One open section at a time, across a run of `FormSection`s.
 *
 * Each section used to hold its own `useState(false)`, so all five of the edit
 * dialog's could be open together and the form went back to being the flat
 * eleven-control stack the folds were introduced to break up. The rule is now
 * the same one every fold in the app follows (`PropertyFolds` for the designers'
 * accordions), and this is the modal's half of it.
 *
 * **A `useId` per section rather than a name.** The group needs to tell its
 * sections apart, and the obvious key — the title — is a derived id, which this
 * codebase does not do: two sections that happened to share a word would open
 * and close together, and the failure would look like a bug in the animation.
 * `useId` is unique per mounted instance and costs the call sites nothing, which
 * is why none of the five had to change.
 *
 * A `FormSection` outside a group keeps its own state, so the component is still
 * usable on its own.
 */
type FormSectionGroupValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const FormSectionGroupContext = createContext<FormSectionGroupValue | null>(null);

export function useFormSectionGroup(): FormSectionGroupValue | null {
  return useContext(FormSectionGroupContext);
}

export function FormSectionGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const value = useMemo(() => ({ openId, setOpenId }), [openId]);
  const root = useRef<HTMLDivElement>(null);

  /*
   * Follow whichever section just changed, in step with it — the same reveal the
   * designers' folds do (`PropertyFolds`), so a section is not left below the fold of
   * `Modal.Body`'s scroller.
   *
   * On the set rather than on each section, because a *closing* section's own effect
   * cannot do this: it runs, finds nothing expanded and returns, which is exactly the
   * collapse that jumps 289px at the end of it in this dialog. See `revealFold`.
   */
  useEffect(() => revealFoldIn(root.current, ".disclosure"), [openId]);

  return (
    <FormSectionGroupContext value={value}>
      <div ref={root} className={className}>
        {children}
      </div>
    </FormSectionGroupContext>
  );
}
