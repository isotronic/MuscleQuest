import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase } from "@/utils/db/connection";
import { fetchExercisesByIds } from "@/utils/db/exercises";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

describe("fetchExercisesByIds", () => {
  beforeEach(async () => {
    const created = createNodeSqliteDb();
    await runMigrations(created.db);
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
    created.sqlite.exec(`
      INSERT INTO exercises (exercise_id, name, tracking_type, secondary_muscles, is_deleted)
      VALUES (1, 'Bench Press', 'weight', '["triceps"]', 0),
             (2, 'Old Custom', 'reps', NULL, 1),
             (3, 'Plank', 'time', 'not json', 0);
    `);
  });

  it("returns the live rows with muscles parsed", async () => {
    const rows = await fetchExercisesByIds([1, 2, 3]);
    expect(
      rows.map((r) => [r.exercise_id, r.tracking_type, r.secondary_muscles]),
    ).toEqual([
      [1, "weight", ["triceps"]],
      [3, "time", []],
    ]);
  });

  it("returns nothing for no ids without opening the database", async () => {
    (openDatabase as jest.Mock).mockClear();
    expect(await fetchExercisesByIds([])).toEqual([]);
    expect(openDatabase).not.toHaveBeenCalled();
  });
});
