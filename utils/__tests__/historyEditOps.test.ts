import {
  buildHistoryEditOps,
  clockText,
  composeLocalMoment,
  EditableWorkout,
  parseClockMinutes,
} from "../historyEditOps";
import { toLocalDateKey } from "../dates";

const workout = (): EditableWorkout => ({
  completedAt: new Date(2026, 8, 30, 18, 0),
  durationSeconds: 3600,
  notes: null,
  exercises: [
    {
      completed_exercise_id: 1,
      exercise_id: 100,
      exercise_name: "Bench Press",
      exercise_tracking_type: "weight",
      sets: [
        {
          set_id: 11,
          set_number: 1,
          weight: 60,
          reps: 8,
          time: null,
          distance: null,
          is_warmup: false,
          set_duration: null,
        },
      ],
    },
  ],
});

describe("buildHistoryEditOps", () => {
  it("emits nothing when nothing changed", () => {
    expect(buildHistoryEditOps(workout(), workout(), "kg", "m")).toEqual([]);
  });

  it("orders removals before changes before additions", () => {
    const edited = workout();
    edited.exercises[0].sets[0].reps = 10;
    edited.exercises[0].sets.push({
      ...edited.exercises[0].sets[0],
      set_id: -1,
      set_number: 2,
    });
    const original = workout();
    original.exercises.push({
      ...original.exercises[0],
      completed_exercise_id: 2,
      sets: [],
    });

    expect(
      buildHistoryEditOps(original, edited, "kg", "m").map((op) => op.kind),
    ).toEqual(["removeExercise", "setValues", "addSet"]);
  });

  it("treats a note of only spaces as no note", () => {
    const edited = workout();
    edited.exercises[0].sets[0].note = "  ";
    edited.notes = " ";
    expect(buildHistoryEditOps(workout(), edited, "kg", "m")).toEqual([]);
  });

  it("includes only the meta fields that changed", () => {
    const edited = workout();
    edited.durationSeconds = 1800;
    expect(buildHistoryEditOps(workout(), edited, "kg", "m")).toEqual([
      { kind: "workoutMeta", durationSeconds: 1800 },
    ]);
  });
});

describe("clock helpers", () => {
  it("round-trips minutes through H:MM", () => {
    expect(clockText(65)).toBe("1:05");
    expect(parseClockMinutes("1:05")).toBe(65);
    expect(parseClockMinutes("0:00")).toBe(0);
  });

  it("rejects values that are not H:MM", () => {
    expect(parseClockMinutes("1:75")).toBeNull();
    expect(parseClockMinutes("abc")).toBeNull();
  });

  it("composes a local moment on the given training day", () => {
    const moment = composeLocalMoment("2026-03-29", 23 * 60 + 30);
    expect(toLocalDateKey(moment)).toBe("2026-03-29");
    expect([moment.getHours(), moment.getMinutes()]).toEqual([23, 30]);
  });
});
