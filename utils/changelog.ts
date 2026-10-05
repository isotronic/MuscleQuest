import type { Release, WhatsNewEntry } from "@/constants/WhatsNew";

export interface ReleaseGroup {
  release: Release;
  entries: WhatsNewEntry[];
}

/**
 * Groups entries under their release, newest release first and newest entry
 * first within each. Releases without entries are left out.
 */
export function groupEntriesByRelease(
  releases: Release[],
  entries: WhatsNewEntry[],
): ReleaseGroup[] {
  return releases
    .map((release) => ({
      release,
      entries: entries
        .filter((entry) => entry.release === release.version)
        .sort((a, b) => b.version - a.version),
    }))
    .filter((group) => group.entries.length > 0)
    .reverse();
}

/**
 * Splits a translated What's New message into its first line (the emoji
 * headline) and the paragraphs after it.
 */
export function splitEntryMessage(text: string): {
  title: string;
  body: string;
} {
  const trimmed = text.trim();
  const breakAt = trimmed.indexOf("\n");
  if (breakAt === -1) return { title: trimmed, body: "" };
  return {
    title: trimmed.slice(0, breakAt).trim(),
    body: trimmed.slice(breakAt + 1).trim(),
  };
}

/** "2026-07" -> "July 2026" in the given locale. */
export function formatReleaseDate(date: string, locale: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}
