import { readFileSync } from "fs";
import path from "path";
import { Platform } from "react-native";
import {
  settingTarget,
  buildSettingsSearch,
  searchSettings,
  SETTINGS_INDEX,
  SETTINGS_SCREENS,
  translateSettingsIndex,
} from "../settingsIndex";

jest.mock("@lingui/core/macro", () => ({
  msg: (s: TemplateStringsArray) => ({ message: s[0] }),
}));
let mockHasTranslations = false;
jest.mock("@/utils/db/exerciseNames", () => ({
  hasExerciseNameTranslations: () => mockHasTranslations,
}));

/** msgid -> msgstr from a locale's catalog, as the app would show it. */
function catalog(locale: string): Map<string, string> {
  const po = readFileSync(
    path.join(__dirname, `../../locales/${locale}/messages.po`),
    "utf8",
  );
  const entries = new Map<string, string>();
  for (const m of po.matchAll(/^msgid "(.*)"\nmsgstr "(.*)"$/gm)) {
    if (m[1]) entries.set(m[1], m[2]);
  }
  return entries;
}

const english = (d: { message?: string }) => d.message ?? "";
const german = () => {
  const de = catalog("de");
  return (d: { message?: string }) => {
    const translated = de.get(d.message ?? "");
    if (!translated) throw new Error(`No German for "${d.message}"`);
    return translated;
  };
};

const search = (
  translate: (d: { message?: string }) => string,
  query: string,
) =>
  searchSettings(
    buildSettingsSearch(translateSettingsIndex(translate as never)),
    query,
  );

describe("settings search", () => {
  it("finds rest settings on the Workout screen and backup in Data", () => {
    expect(search(english, "rest")[0].screen).toBe("workout");
    expect(search(english, "default rest time")[0].id).toBe("defaultRestTime");
    expect(search(english, "backup")[0]).toMatchObject({
      id: "backup",
      screen: "data",
    });
  });

  it("forgives a typo like the help search", () => {
    expect(search(english, "bakcup")[0].id).toBe("backup");
  });

  it("finds the same rows in German", () => {
    const translate = german();
    expect(search(translate, "Pause")[0].screen).toBe("workout");
    expect(search(translate, "Sicherung")[0]).toMatchObject({
      id: "backup",
      screen: "data",
    });
  });

  it("lists the Android rest alert settings on Android only", () => {
    const os = Platform.OS;
    const ids = () => translateSettingsIndex(english).map((d) => d.id);
    try {
      Platform.OS = "android";
      expect(ids()).toEqual(
        expect.arrayContaining(["restAlertOnSilent", "exactRestAlerts"]),
      );
      Platform.OS = "ios";
      expect(ids()).not.toContain("restAlertOnSilent");
      expect(ids()).not.toContain("exactRestAlerts");
    } finally {
      Platform.OS = os;
    }
  });

  it("lists the exercise name setting only where names are translated", () => {
    const ids = () => translateSettingsIndex(english).map((d) => d.id);
    try {
      mockHasTranslations = false;
      expect(ids()).not.toContain("translateExerciseNames");
      mockHasTranslations = true;
      expect(ids()).toContain("translateExerciseNames");
      expect(search(german(), "Übungsnamen")[0]).toMatchObject({
        id: "translateExerciseNames",
        screen: "appearance",
      });
    } finally {
      mockHasTranslations = false;
    }
  });

  it("returns nothing for an empty query", () => {
    expect(search(english, "  ")).toEqual([]);
  });

  it("indexes rows of known screens only, each id once", () => {
    const screens = new Set<string>(SETTINGS_SCREENS.map((s) => s.id));
    const ids = SETTINGS_INDEX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of SETTINGS_INDEX) {
      expect(screens.has(entry.screen)).toBe(true);
    }
  });

  it("opens the row that unlocks a hidden one", () => {
    const signedOut = { signedIn: false, progressionOn: false };
    const all = { signedIn: true, progressionOn: true };
    expect(settingTarget("privacy", signedOut)).toBe("account");
    expect(settingTarget("deleteAccount", signedOut)).toBe("account");
    expect(settingTarget("progressionIncrements", signedOut)).toBe(
      "adaptiveProgression",
    );
    expect(settingTarget("excludeDeload", signedOut)).toBe(
      "adaptiveProgression",
    );
    expect(settingTarget("privacy", all)).toBe("privacy");
    expect(settingTarget("excludeDeload", all)).toBe("excludeDeload");
    expect(settingTarget("defaultRestTime", signedOut)).toBe("defaultRestTime");
  });
});
