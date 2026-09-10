import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMBED_ACCENT,
  DEFAULT_EMBED_SETTINGS,
  readEmbedSettings,
} from "./embed-settings.schema";

/**
 * The colour half specifically, because it is the one field in this table whose
 * default reaches a stranger's website.
 *
 * Everything else here resolves a control's position; the accent is written into
 * a published snapshot and read forever by a site we do not control, so the two
 * things worth pinning are that an unset accent gains the product default and
 * that the other four tokens still gain nothing (CLAUDE.md §7 — absent is what
 * lets `.lm-root--dark` redefine them).
 */
describe("readEmbedSettings colours", () => {
  it("gives an uncoloured map the product accent and nothing else", () => {
    const { colors } = readEmbedSettings({});

    expect(colors).toEqual({ accent: DEFAULT_EMBED_ACCENT });
  });

  it("lets the owner's own accent win over the default", () => {
    const { colors } = readEmbedSettings({ colors: { accent: "#00aa88" } });

    expect(colors?.accent).toBe("#00aa88");
  });

  it("keeps the other four absent so they can follow a dark basemap", () => {
    const { colors } = readEmbedSettings({ colors: { border: "#123456" } });

    expect(colors).toEqual({
      accent: DEFAULT_EMBED_ACCENT,
      border: "#123456",
    });
    expect(colors?.surface).toBeUndefined();
    expect(colors?.foreground).toBeUndefined();
    expect(colors?.muted).toBeUndefined();
  });

  it("falls back to the default when the stored value is unparseable", () => {
    // The column is free-form JSON that an older build or a console edit may
    // have written, so a bad value must not take the accent down with it.
    expect(readEmbedSettings({ colors: "orange" }).colors).toEqual({
      accent: DEFAULT_EMBED_ACCENT,
    });
    expect(readEmbedSettings({ colors: { accent: "not a colour" } }).colors).toEqual(
      { accent: DEFAULT_EMBED_ACCENT },
    );
  });

  it("clearing the accent lands back on the default, not on the embed's blue", () => {
    // What `ColorsGroup` writes when the clear button is pressed: the key is
    // deleted, and `colors` goes undefined once it was the only one set.
    expect(readEmbedSettings({ colors: undefined }).colors).toEqual({
      accent: DEFAULT_EMBED_ACCENT,
    });
  });

  it("agrees with the table the designer's controls are drawn from", () => {
    expect(DEFAULT_EMBED_SETTINGS.colors).toEqual({
      accent: DEFAULT_EMBED_ACCENT,
    });
  });
});

/**
 * The two fields added for the narrow-width drawer, and the one that closed the
 * grey-pin gap between the editor and a published map.
 *
 * Both are here for the same reason the accent is: they are written into a
 * snapshot and read forever by a site we do not control. What has to hold is the
 * asymmetry §7 turns on — this reader answers for a *stored* map, so absent is
 * the current design, while the embed answers for a *published* one, where
 * absent is what it drew before the field existed.
 */
describe("readEmbedSettings drawer and pin colour", () => {
  it("gives a map nobody has designed both new answers", () => {
    const settings = readEmbedSettings({});

    expect(settings.panelDrawer).toBe(true);
    expect(settings.pinColor).toBe(DEFAULT_EMBED_ACCENT);
  });

  it("lets the owner switch the drawer off", () => {
    expect(readEmbedSettings({ panelDrawer: false }).panelDrawer).toBe(false);
  });

  it("lets the owner's own pin colour win over the default", () => {
    expect(readEmbedSettings({ pinColor: "#00aa88" }).pinColor).toBe("#00aa88");
  });

  it("falls back rather than throwing on a pin colour that is not one", () => {
    // This column is free-form JSON — an older build or a console edit can have
    // put anything in it, and a designer that cannot open is worse than one
    // showing the default.
    expect(readEmbedSettings({ pinColor: "rebeccapurple" }).pinColor).toBe(
      DEFAULT_EMBED_ACCENT,
    );
    expect(readEmbedSettings({ pinColor: 42 }).pinColor).toBe(
      DEFAULT_EMBED_ACCENT,
    );
  });

  it("keeps the panel at its Slim and Glass stops", () => {
    // The two values behind the labels `PanelGroup` offers. Pinned because they
    // are what a new map publishes, and a change here is a change to every map
    // published from now on.
    expect(DEFAULT_EMBED_SETTINGS.panelWidth).toBe(25);
    expect(DEFAULT_EMBED_SETTINGS.panelOpacity).toBe(60);
  });
});
