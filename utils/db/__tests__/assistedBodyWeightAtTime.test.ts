// Assisted sets are judged by (body weight - assistance). Every PR and
// progression number must use the body weight logged at the time of the
// workout, not today's: losing weight should not rewrite past records.
import { useQuery } from "@tanstack/react-query";
import { fetchPriorBests, fetchRecentPRs } from "@/utils/db/workoutStats";
import { fetchPRDataForExercises } from "@/utils/db/workouts";
import { useExerciseDetailQuery } from "@/hooks/useExerciseDetailQuery";
import { useTrackedExercisesQuery } from "@/hooks/useTrackedExercisesQuery";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));
jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));

// 60 kg moved at 8 reps, the same in both sessions when each uses its own
// body weight (90 kg in March, 80 kg in April). With today's 70 kg, March
// would read 40 kg and April 50 kg, a PR.
const METRIC = 60 * (1 + 8 / 30);

const queryFn = () => (useQuery as jest.Mock).mock.calls.at(-1)![0].queryFn();

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
  mockDb.sqlite.exec(`
    INSERT INTO body_parts (body_part) VALUES ('back');
    INSERT INTO exercises (exercise_id, name, body_part, tracking_type)
      VALUES (1, 'Assisted Pull-up', 'back', 'assisted');
    INSERT INTO tracked_exercises (exercise_id) VALUES (1);
    INSERT INTO body_measurements (date, body_weight) VALUES
      ('2026-03-01T08:00:00.000Z', 90),
      ('2026-04-01T08:00:00.000Z', 80),
      ('2026-05-01T08:00:00.000Z', 70);
    INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', '70');
  `);
  const sessions: [number, string, number][] = [
    [1, "2026-03-10", 30],
    [2, "2026-04-10", 20],
  ];
  for (const [id, day, assistance] of sessions) {
    mockDb.sqlite
      .prepare(
        `INSERT INTO completed_workouts (id, date_completed, local_date, duration) VALUES (?, ?, ?, 3600)`,
      )
      .run(id, `${day}T18:00:00.000Z`, day);
    mockDb.sqlite
      .prepare(
        `INSERT INTO completed_exercises (id, completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, 1, 'assisted')`,
      )
      .run(id, id);
    mockDb.sqlite
      .prepare(
        `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, ?, 8, 0)`,
      )
      .run(id, assistance);
  }
});

afterEach(() => mockDb.sqlite.close());

describe("assisted PRs use the body weight at the time", () => {
  it("does not call a tie a PR", async () => {
    expect(await fetchRecentPRs({}, { trackedOnly: false, limit: 10 })).toEqual(
      [],
    );
  });

  it("gives the live session the right best to beat", async () => {
    const [best] = await fetchPriorBests([1]);
    expect(best.best).toBeCloseTo(METRIC, 6);
  });

  it("dates the all-time PR to the first session that reached it", async () => {
    const [data] = await fetchPRDataForExercises([1]);
    expect(data.all_time_pr).toBeCloseTo(METRIC, 6);
    expect(data.all_time_pr_date).toBe("2026-03-10");
  });

  it("charts both sessions at the same level on the exercise screen", async () => {
    useExerciseDetailQuery(1, "0", "kg");
    const detail = await queryFn();
    const metrics = detail.recentSessions.map(
      (s: { bestSet: { progressionMetric: number } }) =>
        s.bestSet.progressionMetric,
    );
    expect(metrics).toHaveLength(2);
    for (const m of metrics) expect(m).toBeCloseTo(METRIC, 6);
    expect(detail.allTimePR).toBeCloseTo(METRIC, 6);
  });

  it("charts both sessions at the same level for a pinned exercise", async () => {
    useTrackedExercisesQuery("0");
    const [tracked] = await queryFn();
    expect(tracked.completed_sets).toHaveLength(2);
    for (const set of tracked.completed_sets) {
      expect(set.progressionMetric).toBeCloseTo(METRIC, 6);
    }
    expect(tracked.allTimePR).toBeCloseTo(METRIC, 6);
  });
});
