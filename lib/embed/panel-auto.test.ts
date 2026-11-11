import { describe, expect, it } from "vitest";

import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";
import {
  isSingleAuto,
  publishedPlaceCount,
  resolvePanelAuto,
} from "./panel-auto";

describe("readEmbedSettings listAuto", () => {
  it("is automatic for a map that never wrote it", () => {
    expect(readEmbedSettings({}).listAuto).toBe(true);
    // `list: true` was only ever the default, not a decision.
    expect(readEmbedSettings({ list: true }).listAuto).toBe(true);
  });

  it("keeps a panel the owner switched off as their choice", () => {
    expect(readEmbedSettings({ list: false }).listAuto).toBe(false);
  });

  it("reads a stored answer as written", () => {
    expect(readEmbedSettings({ list: true, listAuto: false }).listAuto).toBe(false);
    expect(readEmbedSettings({ list: false, listAuto: true }).listAuto).toBe(true);
  });
});

describe("resolvePanelAuto", () => {
  const auto = readEmbedSettings({});

  it("hides the panel and the search box for one location or none", () => {
    for (const count of [0, 1]) {
      const resolved = resolvePanelAuto(auto, count);

      expect(resolved.list).toBe(false);
      expect(resolved.search).toBe(false);
      expect(resolved.nearest).toBe(true);
      expect(isSingleAuto(auto, count)).toBe(true);
    }
  });

  it("shows the panel and leaves search as stored for two or more", () => {
    const resolved = resolvePanelAuto({ ...auto, list: false, search: false }, 2);

    expect(resolved.list).toBe(true);
    expect(resolved.search).toBe(false);
    expect(isSingleAuto(auto, 2)).toBe(false);
  });

  it("passes an owner's own answer through untouched", () => {
    const owned = { ...auto, listAuto: false, list: true, search: true };

    expect(resolvePanelAuto(owned, 1)).toBe(owned);
    expect(isSingleAuto(owned, 1)).toBe(false);
  });
});

describe("publishedPlaceCount", () => {
  it("counts only locations with a position", () => {
    expect(
      publishedPlaceCount([
        { lat: 54.6, lng: 25.2 },
        { lat: Number.NaN, lng: 25.2 },
        { lat: 54.6, lng: 200 },
      ]),
    ).toBe(1);
  });
});
