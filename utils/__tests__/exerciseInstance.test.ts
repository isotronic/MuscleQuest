import {
  instanceName,
  loggedInstanceName,
  matchSessionInstance,
  occurrenceIndex,
  rowIdentity,
} from "../exerciseInstance";
import { historyForRow } from "../historyUtils";

const rows = [{ exercise_id: 1 }, { exercise_id: 2 }, { exercise_id: 1 }];

describe("occurrenceIndex", () => {
  it("counts earlier rows of the same exercise", () => {
    expect(rows.map((_, i) => occurrenceIndex(rows, i))).toEqual([0, 0, 1]);
  });
});

describe("instanceName", () => {
  it("numbers only the repeats", () => {
    expect(rows.map((_, i) => instanceName(rows, i, "Squat"))).toEqual([
      "Squat",
      "Squat",
      "Squat (2)",
    ]);
  });
});

describe("loggedInstanceName", () => {
  it("numbers a lone back-off block by its plan block", () => {
    const logged = [{ exercise_id: 1, plan_occurrence: 1 }];
    expect(loggedInstanceName(logged, 0, "Squat")).toBe("Squat (2)");
  });

  it("numbers by order when no plan block was recorded", () => {
    const logged = [
      { exercise_id: 1, plan_occurrence: null },
      { exercise_id: 1, plan_occurrence: null },
    ];
    expect(loggedInstanceName(logged, 1, "Squat")).toBe("Squat (2)");
  });
});

describe("historyForRow", () => {
  const sessions = [
    {
      exercises: [
        { exercise_id: 1, tag: "heavy" },
        { exercise_id: 1, tag: "back-off" },
      ],
    },
    { exercises: [{ exercise_id: 1, tag: "only" }] },
    { exercises: [{ exercise_id: 2, tag: "other" }] },
  ];

  it("takes each session's matching block by order, else its first", () => {
    const tags = (index: number) =>
      historyForRow(sessions, rowIdentity(rows, index)).map((e) => e.tag);
    expect(tags(0)).toEqual(["heavy", "only"]);
    expect(tags(2)).toEqual(["back-off", "only"]);
  });
});

describe("matchSessionInstance", () => {
  const plan = [
    { exercise_id: 1, id: 11 },
    { exercise_id: 1, id: 13 },
  ];
  const logged = (...rowIds: (number | null)[]) =>
    rowIds.map((id) => ({ exercise_id: 1, user_workout_exercise_id: id }));

  it("prefers the block logged from the same plan row", () => {
    expect(
      matchSessionInstance(logged(13, 11), rowIdentity(plan, 0))
        ?.user_workout_exercise_id,
    ).toBe(11);
  });

  it("skips a session that only logged the other block", () => {
    expect(
      matchSessionInstance(logged(13), rowIdentity(plan, 0)),
    ).toBeUndefined();
  });

  it("matches by order when the rows are unknown", () => {
    const old = [
      { exercise_id: 1, tag: "first" },
      { exercise_id: 1, tag: "second" },
    ];
    expect(matchSessionInstance(old, rowIdentity(plan, 1))?.tag).toBe("second");
  });
});
