import { setupUserDb } from "@/utils/db/testing/setupUserDb";
import { fetchNote, saveNote } from "@/utils/db/notes";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

describe("notes", () => {
  let sqlite: Awaited<ReturnType<typeof setupUserDb>>["sqlite"];

  beforeEach(async () => {
    ({ sqlite } = await setupUserDb());
  });

  afterEach(() => sqlite.close());

  it.each([null, 7])(
    "reads back a note saved with secondary reference %p",
    async (secondary) => {
      await saveNote(3, secondary, "Keep elbows tucked", "workout_exercise");

      expect(await fetchNote(3, secondary, "workout_exercise")).toBe(
        "Keep elbows tucked",
      );
    },
  );

  // Review Focus 4: NULLs are distinct in a UNIQUE index, so only the id
  // subquery stops a second row for the null secondary reference.
  it("keeps one row per key holding the latest text", async () => {
    await saveNote(3, null, "first", "workout_exercise");
    await saveNote(3, null, "second", "workout_exercise");
    await saveNote(3, 7, "other first", "workout_exercise");
    await saveNote(3, 7, "other second", "workout_exercise");

    expect(
      sqlite
        .prepare(
          `SELECT secondary_reference_id AS secondary, note FROM notes
           ORDER BY secondary_reference_id`,
        )
        .all(),
    ).toEqual([
      { secondary: null, note: "second" },
      { secondary: 7, note: "other second" },
    ]);
  });

  it("keeps notes of different types apart", async () => {
    await saveNote(3, null, "exercise note", "exercise");
    await saveNote(3, null, "workout note", "workout");

    expect(await fetchNote(3, null, "exercise")).toBe("exercise note");
    expect(await fetchNote(3, null, "workout")).toBe("workout note");
  });

  it("returns an empty string when there is no note", async () => {
    expect(await fetchNote(3, null, "plan")).toBe("");
  });
});
