import { applyWorkoutChanges, diffWorkout } from "../workoutChanges";
import type {
  Set as WorkoutSet,
  UserExercise,
  Workout,
} from "@/store/workoutStore";

const set = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({
  repsMin: 8,
  repsMax: 10,
  restMinutes: 1,
  restSeconds: 30,
  time: undefined,
  ...patch,
});

const ex = (
  exerciseId: number,
  id: number | undefined,
  patch: Partial<UserExercise> = {},
): UserExercise =>
  ({
    id,
    exercise_id: exerciseId,
    name: `Ex ${exerciseId}`,
    sets: [set(), set(), set()],
    ...patch,
  }) as UserExercise;

const workout = (...exercises: UserExercise[]): Workout => ({
  name: "Push",
  exercises,
});

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Exercise ids in order, with their superset group and set count. */
const shape = (exercises: UserExercise[]) =>
  exercises.map(
    (e) =>
      `${e.exercise_id}${e.supersetGroupId ? `[${e.supersetGroupId}]` : ""}x${e.sets.length}`,
  );

const all = (original: Workout, current: Workout) =>
  diffWorkout(original, current).map((c) => c.id);

describe("diffWorkout", () => {
  const original = workout(ex(1, 11), ex(2, 12), ex(3, 13));

  it("finds nothing for an unchanged session", () => {
    expect(diffWorkout(original, clone(original))).toEqual([]);
  });

  it("names an added exercise", () => {
    const current = workout(...clone(original.exercises), ex(4, undefined));
    expect(diffWorkout(original, current)).toEqual([
      { id: "add:new:3", kind: "added", name: "Ex 4" },
    ]);
  });

  it("names a removed exercise", () => {
    const current = workout(ex(1, 11), ex(3, 13));
    expect(diffWorkout(original, current)).toEqual([
      { id: "remove:id:12", kind: "removed", name: "Ex 2" },
    ]);
  });

  it("pairs a replaced exercise into one swap", () => {
    const current = workout(ex(1, 11), ex(9, undefined), ex(3, 13));
    expect(diffWorkout(original, current)).toEqual([
      {
        id: "swap:id:12",
        kind: "swapped",
        from: "Ex 2",
        to: "Ex 9",
        details: [],
      },
    ]);
  });

  it("summarises what changed on an exercise", () => {
    const current = clone(original);
    current.exercises[0].sets.push(set());
    current.exercises[1].sets[0].repsMax = 12;
    current.exercises[1].sets[1].restSeconds = 0;
    current.exercises[2].sets[2].isDropSet = true;
    current.exercises[2].tracking_type_override = "weight";

    expect(diffWorkout(original, current)).toEqual([
      {
        id: "modify:id:11",
        kind: "modified",
        name: "Ex 1",
        details: [{ kind: "setCount", from: 3, to: 4 }],
      },
      {
        id: "modify:id:12",
        kind: "modified",
        name: "Ex 2",
        details: [{ kind: "targets" }, { kind: "rest" }],
      },
      {
        id: "modify:id:13",
        kind: "modified",
        name: "Ex 3",
        details: [{ kind: "setTypes" }, { kind: "tracking" }],
      },
    ]);
  });

  it("reports a new order once", () => {
    const current = workout(ex(3, 13), ex(1, 11), ex(2, 12));
    expect(diffWorkout(original, current)).toEqual([
      { id: "order", kind: "reordered" },
    ]);
  });

  it("counts a superset partner and its link as one addition", () => {
    const current = workout(
      ex(1, 11, { supersetGroupId: "g" }),
      ex(7, undefined, { supersetGroupId: "g" }),
      ex(2, 12),
      ex(3, 13),
    );
    expect(diffWorkout(original, current)).toEqual([
      { id: "add:new:1", kind: "added", name: "Ex 7", supersetWith: "Ex 1" },
    ]);
  });

  it("does not mistake a superset partner for a swap", () => {
    const current = workout(
      ex(1, 11, { supersetGroupId: "g" }),
      ex(7, undefined, { supersetGroupId: "g" }),
      ex(3, 13),
    );
    expect(all(original, current)).toEqual(["remove:id:12", "add:new:1"]);
  });

  it("counts an unlinked superset as one change", () => {
    const linked = workout(
      ex(1, 11, { supersetGroupId: "g" }),
      ex(2, 12, { supersetGroupId: "g" }),
      ex(3, 13),
    );
    const current = workout(ex(1, 11), ex(2, 12), ex(3, 13));
    expect(diffWorkout(linked, current)).toEqual([
      { id: "unlink:g", kind: "unlinked", names: ["Ex 1", "Ex 2"] },
    ]);
  });

  it("ignores set fields that differ only by being absent", () => {
    const current = clone(original);
    current.exercises[0].sets[0] = {
      ...current.exercises[0].sets[0],
      distance: undefined,
    };
    delete (current.exercises[1].sets[0] as Partial<WorkoutSet>).time;
    expect(diffWorkout(original, current)).toEqual([]);
  });
});

describe("applyWorkoutChanges", () => {
  const original = workout(ex(1, 11), ex(2, 12), ex(3, 13));

  it("returns the session as it ended when every change is chosen", () => {
    const current = workout(
      ex(3, 13, { sets: [set()] }),
      ex(1, 11),
      ex(9, undefined),
      ex(4, undefined),
    );
    const result = applyWorkoutChanges(
      original,
      current,
      all(original, current),
    );
    expect(result).toEqual(current.exercises);
  });

  it("rebuilds a session with a new superset and an unlinked one", () => {
    const linked = workout(
      ex(1, 11),
      ex(2, 12, { supersetGroupId: "a" }),
      ex(3, 13, { supersetGroupId: "a" }),
    );
    const current = workout(
      ex(1, 11, { supersetGroupId: "b" }),
      ex(7, undefined, { supersetGroupId: "b" }),
      ex(3, 13, { sets: [set(), set()] }),
      ex(2, 12),
    );
    const ids = all(linked, current);
    expect(ids.sort()).toEqual(
      ["add:new:1", "modify:id:13", "order", "unlink:a"].sort(),
    );
    expect(applyWorkoutChanges(linked, current, ids)).toEqual(
      current.exercises,
    );
  });

  it("returns the original when nothing is chosen", () => {
    const current = workout(
      ex(3, 13, { sets: [set()] }),
      ex(1, 11),
      ex(4, undefined),
    );
    expect(applyWorkoutChanges(original, current, [])).toEqual(
      original.exercises,
    );
  });

  it("keeps a removed exercise in its place when its removal is not chosen", () => {
    const current = workout(ex(1, 11), ex(3, 13), ex(4, undefined));
    const result = applyWorkoutChanges(original, current, ["add:new:2"]);
    expect(shape(result)).toEqual(["1x3", "2x3", "3x3", "4x3"]);
  });

  it("applies set changes only to the chosen exercise", () => {
    const current = clone(original);
    current.exercises[0].sets.push(set());
    current.exercises[2].sets.pop();
    const result = applyWorkoutChanges(original, current, ["modify:id:13"]);
    expect(shape(result)).toEqual(["1x3", "2x3", "3x2"]);
  });

  it("places an added exercise after the one it followed", () => {
    const current = workout(ex(1, 11), ex(5, undefined), ex(2, 12), ex(3, 13));
    expect(
      shape(applyWorkoutChanges(original, current, ["add:new:1"])),
    ).toEqual(["1x3", "5x3", "2x3", "3x3"]);
  });

  it("keeps the old order when the new one is not chosen", () => {
    const current = workout(ex(3, 13), ex(1, 11), ex(2, 12), ex(4, undefined));
    expect(
      shape(applyWorkoutChanges(original, current, ["add:new:3"])),
    ).toEqual(["1x3", "2x3", "4x3", "3x3"]);
  });

  it("takes the new order with an unchosen removal staying behind its neighbour", () => {
    const current = workout(ex(3, 13), ex(1, 11));
    expect(shape(applyWorkoutChanges(original, current, ["order"]))).toEqual([
      "3x3",
      "1x3",
      "2x3",
    ]);
  });

  it("keeps the old exercise when a swap is not chosen", () => {
    const current = workout(ex(1, 11), ex(9, undefined), ex(3, 13));
    expect(shape(applyWorkoutChanges(original, current, []))).toEqual([
      "1x3",
      "2x3",
      "3x3",
    ]);
    const swapped = applyWorkoutChanges(original, current, ["swap:id:12"]);
    expect(shape(swapped)).toEqual(["1x3", "9x3", "3x3"]);
    // A new row, so the old one is retired rather than repointed.
    expect(swapped[1].id).toBeUndefined();
  });

  it("links the superset only when its partner is added", () => {
    const current = workout(
      ex(1, 11, { supersetGroupId: "g", sets: [set(), set()] }),
      ex(7, undefined, { supersetGroupId: "g" }),
      ex(2, 12),
      ex(3, 13),
    );
    expect(
      shape(applyWorkoutChanges(original, current, ["add:new:1"])),
    ).toEqual(["1[g]x3", "7[g]x3", "2x3", "3x3"]);
    // Its set change alone leaves it out of the superset.
    expect(
      shape(applyWorkoutChanges(original, current, ["modify:id:11"])),
    ).toEqual(["1x2", "2x3", "3x3"]);
  });

  it("unlinks a superset only when chosen", () => {
    const linked = workout(
      ex(1, 11, { supersetGroupId: "g" }),
      ex(2, 12, { supersetGroupId: "g" }),
      ex(3, 13),
    );
    const current = workout(ex(1, 11), ex(2, 12), ex(3, 13, { sets: [set()] }));
    expect(
      shape(applyWorkoutChanges(linked, current, ["modify:id:13"])),
    ).toEqual(["1[g]x3", "2[g]x3", "3x1"]);
    expect(shape(applyWorkoutChanges(linked, current, ["unlink:g"]))).toEqual([
      "1x3",
      "2x3",
      "3x3",
    ]);
  });

  it("drops a superset link that lost its partner", () => {
    const linked = workout(
      ex(1, 11, { supersetGroupId: "g" }),
      ex(2, 12, { supersetGroupId: "g" }),
      ex(3, 13),
    );
    // Deleting one half leaves the other's group id behind in the session.
    const current = workout(ex(1, 11, { supersetGroupId: "g" }), ex(3, 13));
    expect(
      shape(applyWorkoutChanges(linked, current, ["remove:id:12"])),
    ).toEqual(["1x3", "3x3"]);
  });

  it("does not change the workouts it was given", () => {
    const current = workout(ex(1, 11), ex(4, undefined));
    const before = clone([original, current]);
    applyWorkoutChanges(original, current, all(original, current));
    expect([original, current]).toEqual(before);
  });
});
