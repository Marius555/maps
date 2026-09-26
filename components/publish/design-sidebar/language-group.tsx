"use client";

import { SelectControl } from "@/components/ui/select-control";
import { EMBED_LANGUAGES } from "@/lib/embed/languages";
import { WordingDialog } from "../wording-dialog/wording-dialog";
import type { EmbedDesign } from "./use-embed-design";

const LANGUAGE_OPTIONS = EMBED_LANGUAGES.map((language) => ({
  id: language.id,
  label: language.label,
}));

/**
 * The language the published map speaks, and the owner's own words for any of
 * it. One language per map: the owner knows who their visitors are, and a map
 * that guessed from each browser would ship every table to every visitor.
 */
export function LanguageGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <SelectControl
        variant="secondary"
        label="Language"
        value={settings.language}
        options={LANGUAGE_OPTIONS}
        onChange={(value) => set("language", value)}
      />

      <WordingDialog
        language={settings.language}
        strings={settings.strings}
        onSave={(next) => set("strings", next)}
      />
    </div>
  );
}
