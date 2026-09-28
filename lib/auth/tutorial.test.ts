import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TUTORIAL_PREFS,
  markTutorialSeen,
  markTutorialsSeen,
  shouldShowTutorial,
  tutorialAlwaysPresent,
  unseenTutorials,
} from "./tutorial";

const getPrefs = vi.fn();
const updatePrefs = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    users: {
      getPrefs: (...args: unknown[]) => getPrefs(...args),
      updatePrefs: (...args: unknown[]) => updatePrefs(...args),
    },
  },
}));

beforeEach(() => {
  getPrefs.mockReset();
  updatePrefs.mockReset();
  // Whatever the developer's own shell or .env says, each case starts unset.
  vi.stubEnv("TUTORIAL_ALWAYS_PRESENT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tutorialAlwaysPresent", () => {
  it.each(["true", "1", "yes", " TRUE "])("is on for %j", (value) => {
    vi.stubEnv("TUTORIAL_ALWAYS_PRESENT", value);
    expect(tutorialAlwaysPresent()).toBe(true);
  });

  it.each(["", "false", "0", "no"])("is off for %j", (value) => {
    vi.stubEnv("TUTORIAL_ALWAYS_PRESENT", value);
    expect(tutorialAlwaysPresent()).toBe(false);
  });
});

describe("shouldShowTutorial", () => {
  it("shows to an account that has never dismissed it", async () => {
    getPrefs.mockResolvedValue({});
    expect(await shouldShowTutorial("u1", "editor")).toBe(true);
  });

  it("hides once dismissed", async () => {
    getPrefs.mockResolvedValue({ [TUTORIAL_PREFS.editor]: "2026-09-27T00:00:00.000Z" });
    expect(await shouldShowTutorial("u1", "editor")).toBe(false);
  });

  it("shows even once dismissed while the flag is on, without reading prefs", async () => {
    vi.stubEnv("TUTORIAL_ALWAYS_PRESENT", "true");
    expect(await shouldShowTutorial("u1", "editor")).toBe(true);
    expect(getPrefs).not.toHaveBeenCalled();
  });

  it("keeps each overlay's stamp separate", async () => {
    getPrefs.mockResolvedValue({ [TUTORIAL_PREFS.maps]: "2026-09-27T00:00:00.000Z" });
    expect(await shouldShowTutorial("u1", "maps")).toBe(false);
    expect(await shouldShowTutorial("u1", "editor")).toBe(true);
  });

  it("keeps the editor's stamp under the name it shipped with", () => {
    expect(TUTORIAL_PREFS.editor).toBe("tutorialSeenAt");
  });

  it("hides rather than throwing when prefs cannot be read", async () => {
    getPrefs.mockRejectedValue(new Error("down"));
    expect(await shouldShowTutorial("u1", "editor")).toBe(false);
  });
});

describe("unseenTutorials", () => {
  it("lists every overlay while the flag is on, without reading prefs", async () => {
    vi.stubEnv("TUTORIAL_ALWAYS_PRESENT", "true");
    expect(await unseenTutorials("u1")).toEqual(["maps", "editor", "card", "publish"]);
    expect(getPrefs).not.toHaveBeenCalled();
  });

  it("lists only the overlays with no stamp", async () => {
    getPrefs.mockResolvedValue({
      [TUTORIAL_PREFS.editor]: "2026-09-27T00:00:00.000Z",
      [TUTORIAL_PREFS.card]: "2026-09-27T00:00:00.000Z",
    });
    expect(await unseenTutorials("u1")).toEqual(["maps", "publish"]);
  });

  it("lists none when prefs cannot be read", async () => {
    getPrefs.mockRejectedValue(new Error("down"));
    expect(await unseenTutorials("u1")).toEqual([]);
  });

  it("gives every overlay a stamp of its own", () => {
    expect(new Set(Object.values(TUTORIAL_PREFS)).size).toBe(Object.keys(TUTORIAL_PREFS).length);
  });
});

describe("markTutorialSeen", () => {
  it("keeps the prefs already on the account", async () => {
    getPrefs.mockResolvedValue({ deletionStartedAt: "2026-09-01T00:00:00.000Z" });

    await markTutorialSeen("u1", "editor");

    const { userId, prefs } = updatePrefs.mock.calls[0][0];
    expect(userId).toBe("u1");
    expect(prefs.deletionStartedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(typeof prefs[TUTORIAL_PREFS.editor]).toBe("string");
  });
});

describe("markTutorialsSeen", () => {
  it("stamps every overlay in one write, keeping other prefs and earlier stamps", async () => {
    getPrefs.mockResolvedValue({
      deletionStartedAt: "2026-09-01T00:00:00.000Z",
      [TUTORIAL_PREFS.maps]: "2026-09-02T00:00:00.000Z",
    });

    await markTutorialsSeen("u1", ["maps", "editor", "card", "publish"]);

    expect(updatePrefs).toHaveBeenCalledTimes(1);
    const { prefs } = updatePrefs.mock.calls[0][0];
    expect(prefs.deletionStartedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(prefs[TUTORIAL_PREFS.maps]).toBe("2026-09-02T00:00:00.000Z");
    for (const key of [TUTORIAL_PREFS.editor, TUTORIAL_PREFS.card, TUTORIAL_PREFS.publish]) {
      expect(typeof prefs[key]).toBe("string");
    }
  });
});
