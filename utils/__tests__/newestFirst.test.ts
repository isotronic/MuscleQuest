import { newestFirst } from "../newestFirst";

const at = (iso: string) => ({ toDate: () => new Date(iso) });

describe("newestFirst", () => {
  it("puts the most recent item first without changing the input", () => {
    const items = [
      { id: "old", updatedAt: at("2026-01-01T10:00:00Z") },
      { id: "new", updatedAt: at("2026-03-01T10:00:00Z") },
      { id: "mid", updatedAt: at("2026-02-01T10:00:00Z") },
    ];
    expect(newestFirst(items, (i) => i.updatedAt).map((i) => i.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
    expect(items.map((i) => i.id)).toEqual(["old", "new", "mid"]);
  });
});
