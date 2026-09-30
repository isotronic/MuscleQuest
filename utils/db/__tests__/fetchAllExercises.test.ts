import { fetchAllRecords } from "@/utils/db/exercises";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));

beforeEach(async () => {
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
  const insert = mockDb.sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, image, image_uri, is_deleted) VALUES (?, ?, ?, ?, ?)`,
  );
  insert.run(1, "On disk", new Uint8Array([1, 2, 3]), "file:///doc/1.webp", 0);
  insert.run(2, "Not yet on disk", new Uint8Array([4, 5, 6]), null, 0);
  insert.run(3, "Deleted", null, null, 1);
});

afterEach(() => {
  mockDb.sqlite.close();
});

describe("fetchAllRecords for exercises", () => {
  it("does not load the image bytes of an exercise whose image is on disk", async () => {
    const rows = (await fetchAllRecords("userData.db", "exercises")) as any[];

    expect(rows.map((r) => r.exercise_id)).toEqual([1, 2]);
    expect(rows[0].image).toBeNull();
    expect(rows[0].image_uri).toBe("file:///doc/1.webp");
  });

  it("still loads the bytes while the image is not on disk yet", async () => {
    const rows = (await fetchAllRecords("userData.db", "exercises")) as any[];

    expect(Array.from(rows[1].image)).toEqual([4, 5, 6]);
    expect(rows[1].image_uri).toBeNull();
  });

  it("keeps every other column", async () => {
    const rows = (await fetchAllRecords("userData.db", "exercises")) as any[];

    expect(rows[0]).toMatchObject({ name: "On disk", favorite: 0 });
    expect(Object.keys(rows[0])).toEqual(
      expect.arrayContaining([
        "tracking_type",
        "local_animated_uri",
        "body_part",
      ]),
    );
  });
});
