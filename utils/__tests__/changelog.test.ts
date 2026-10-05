import {
  CURRENT_WHATS_NEW_VERSION,
  RELEASES,
  WHATS_NEW_ENTRIES,
} from "@/constants/WhatsNew";
import {
  formatReleaseDate,
  groupEntriesByRelease,
  splitEntryMessage,
} from "@/utils/changelog";

jest.mock("@lingui/core/macro", () => ({
  msg: (s: TemplateStringsArray) => s[0],
}));

describe("groupEntriesByRelease", () => {
  const releases = [
    { version: "1.0", date: "2026-01" },
    { version: "1.1", date: "2026-02" },
    { version: "1.2", date: "2026-03" },
  ];
  const entry = (version: number, release: string) => ({
    version,
    release,
    message: { id: String(version) },
  });

  it("orders releases and their entries newest first and skips empty releases", () => {
    const groups = groupEntriesByRelease(releases, [
      entry(1, "1.0"),
      entry(2, "1.0"),
      entry(3, "1.2"),
    ]);
    expect(groups.map((g) => g.release.version)).toEqual(["1.2", "1.0"]);
    expect(groups[1].entries.map((e) => e.version)).toEqual([2, 1]);
  });
});

describe("splitEntryMessage", () => {
  it("takes the first line as the title", () => {
    expect(
      splitEntryMessage("\n🎯 New: Thing!\n\nFirst.\n\nSecond.\n"),
    ).toEqual({ title: "🎯 New: Thing!", body: "First.\n\nSecond." });
  });

  it("handles a message with no body", () => {
    expect(splitEntryMessage(" Just a title ")).toEqual({
      title: "Just a title",
      body: "",
    });
  });
});

describe("formatReleaseDate", () => {
  it("formats year and month in the given locale", () => {
    expect(formatReleaseDate("2026-07", "en")).toBe("July 2026");
  });
});

describe("What's New data", () => {
  it("puts every entry in a known release", () => {
    const known = new Set(RELEASES.map((r) => r.version));
    for (const entry of WHATS_NEW_ENTRIES) {
      expect(known).toContain(entry.release);
    }
  });

  it("uses unique versions", () => {
    const versions = WHATS_NEW_ENTRIES.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("keeps entry versions in release order", () => {
    // A newer release must never hold an older entry than an earlier one,
    // so a new entry tagged with an old release fails here.
    const releaseIndex = new Map(RELEASES.map((r, i) => [r.version, i]));
    const sorted = [...WHATS_NEW_ENTRIES].sort((a, b) => a.version - b.version);
    for (let i = 1; i < sorted.length; i++) {
      expect(releaseIndex.get(sorted[i].release)!).toBeGreaterThanOrEqual(
        releaseIndex.get(sorted[i - 1].release)!,
      );
    }
  });

  it("lists releases oldest first with YYYY-MM dates", () => {
    for (const release of RELEASES) {
      expect(release.date).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    }
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("keeps history entries out of the pop-up's range", () => {
    expect(CURRENT_WHATS_NEW_VERSION).toBeGreaterThanOrEqual(2601);
  });
});
