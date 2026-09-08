"use client";

import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import type { EmbedDesign } from "./use-embed-design";

/**
 * Whether this map reports what its visitors do.
 *
 * **The one control in this sidebar that is not about how the map looks**, and
 * the only one whose consequences land on somebody other than the owner. Every
 * other group here changes a colour or a corner; this one starts recording
 * strangers on the owner's website. So it gets a paragraph, which nothing else
 * in this panel does.
 *
 * The paragraph is not decoration and must not be trimmed for symmetry. An owner
 * turning this on becomes a data controller for their visitors, and the least we
 * can do is say plainly what gets stored before they do — in the words a person
 * would use, per §8, and without the reassuring vagueness that would make it
 * useless. Naming the IP address is the point: it is the item somebody would be
 * annoyed to discover afterwards.
 *
 * It says "on your next publish" because that is literally true and is the
 * commonest confusion this panel produces: `settings` is saved immediately, but
 * a live snapshot is immutable and carries the old answer until it is replaced.
 * Nothing starts or stops being measured until Publish is pressed.
 */
export function MeasurementGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <PropertySwitches>
        <PropertySwitch
          label="Measure how visitors use this map"
          isSelected={settings.analytics}
          onChange={(value) => set("analytics", value)}
        />
      </PropertySwitches>

      <p className="text-pretty text-xs leading-relaxed text-muted">
        {settings.analytics ? (
          <>
            Your map will record what visitors search for, which locations they
            open, and which buttons they press — along with their country,
            device, IP address and the page your map is on. No cookies, and
            nothing follows anyone between sites. Starts on your next publish;
            switching it back off stops collection straight away.
          </>
        ) : (
          <>
            Off. Your map sends us nothing about the people who use it. Turn this
            on to see what visitors search for and which locations they open —
            it takes effect on your next publish.
          </>
        )}
      </p>

      {/*
        No link out to a docs page, deliberately: there isn't one yet (Week 4),
        and this panel already follows the rule that a link is only worth
        drawing where it goes somewhere useful.
      */}
      {settings.analytics ? (
        <p className="text-xs leading-relaxed text-muted">
          Telling your own visitors is your job, wherever your privacy policy
          lives.
        </p>
      ) : null}
    </div>
  );
}
