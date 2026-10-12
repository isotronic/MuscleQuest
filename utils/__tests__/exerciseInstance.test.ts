import { instanceName, occurrenceIndex } from "../exerciseInstance";
import { historyForOccurrence } from "../historyUtils";

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

describe("historyForOccurrence", () => {
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

  it("takes each session's matching block, else its first", () => {
    expect(historyForOccurrence(sessions, 1, 0).map((e) => e.tag)).toEqual([
      "heavy",
      "only",
    ]);
    expect(historyForOccurrence(sessions, 1, 1).map((e) => e.tag)).toEqual([
      "back-off",
      "only",
    ]);
  });
});
