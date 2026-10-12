import type {
  Set as WorkoutSet,
  UserExercise,
  Workout,
} from "@/store/workoutStore";

/**
 * The edits a session made to its saved workout, as separate changes the
 * user can pick from when finishing, and the exercise list that results
 * from a chosen subset of them.
 *
 * Exercises are matched by their user_workout_exercises row id. Exercises
 * added during the session have none; a replacement carries the replaced
 * row's id as `replacedFromId`, so it is shown as one swap.
 */

export type ExerciseDetail =
  | { kind: "setCount"; from: number; to: number }
  | { kind: "targets" }
  | { kind: "rest" }
  | { kind: "setTypes" }
  | { kind: "tracking" }
  | { kind: "superset" };

export type WorkoutChange =
  | { id: string; kind: "added"; name: string; supersetWith?: string }
  | { id: string; kind: "removed"; name: string }
  | {
      id: string;
      kind: "swapped";
      from: string;
      to: string;
      details: ExerciseDetail[];
    }
  | { id: string; kind: "modified"; name: string; details: ExerciseDetail[] }
  | { id: string; kind: "unlinked"; names: string[] }
  | { id: "order"; kind: "reordered" };

const ORDER_ID = "order";

/** Where an exercise sits: its original row, or a new one from the session. */
type Slot = string;

interface Analysis {
  original: UserExercise[];
  current: UserExercise[];
  /** Slot of each original exercise, by index. */
  originalSlots: Slot[];
  /** Slot of each current exercise, by index; a swap takes the old slot. */
  currentSlots: Slot[];
  matched: Map<Slot, { o: number; c: number; supersetDetail: boolean }>;
  removed: Map<Slot, number>;
  swapped: Map<Slot, { o: number; c: number }>;
  /** Current index of each addition, with the matched slots it links to. */
  added: Map<Slot, { c: number; links: Slot[] }>;
  /** Superset group id to the matched slots that left it. */
  unlinked: Map<string, Slot[]>;
  reordered: boolean;
}

const groupOf = (e: UserExercise) => e.supersetGroupId ?? null;

const isNew = (slot: Slot) => slot.startsWith("new:");

const countGroups = (exercises: UserExercise[]) => {
  const sizes = new Map<string, number>();
  for (const e of exercises) {
    const group = groupOf(e);
    if (group) sizes.set(group, (sizes.get(group) ?? 0) + 1);
  }
  return sizes;
};

const differs = (
  a: WorkoutSet[],
  b: WorkoutSet[],
  keys: (keyof WorkoutSet)[],
) => a.some((set, i) => i < b.length && keys.some((k) => set[k] !== b[i][k]));

const flagsDiffer = (a: WorkoutSet[], b: WorkoutSet[]) =>
  a.some(
    (set, i) =>
      i < b.length &&
      (!!set.isWarmup !== !!b[i].isWarmup ||
        !!set.isDropSet !== !!b[i].isDropSet ||
        !!set.isToFailure !== !!b[i].isToFailure),
  );

/** What changed between two versions of one exercise, superset aside. */
function exerciseDetails(o: UserExercise, c: UserExercise): ExerciseDetail[] {
  const details: ExerciseDetail[] = [];
  if (o.sets.length !== c.sets.length) {
    details.push({ kind: "setCount", from: o.sets.length, to: c.sets.length });
  }
  if (differs(o.sets, c.sets, ["repsMin", "repsMax", "time", "distance"])) {
    details.push({ kind: "targets" });
  }
  if (differs(o.sets, c.sets, ["restMinutes", "restSeconds"])) {
    details.push({ kind: "rest" });
  }
  if (flagsDiffer(o.sets, c.sets)) details.push({ kind: "setTypes" });
  if (
    (o.tracking_type_override ?? null) !== (c.tracking_type_override ?? null)
  ) {
    details.push({ kind: "tracking" });
  }
  return details;
}

function analyse(originalWorkout: Workout, currentWorkout: Workout): Analysis {
  const original = originalWorkout.exercises;
  const current = currentWorkout.exercises;
  const originalSlots = original.map((e, i) =>
    e.id != null ? `id:${e.id}` : `o:${i}`,
  );
  const slotIndex = new Map(originalSlots.map((s, i) => [s, i]));
  const currentSlots = current.map((e, j) => {
    const slot = e.id != null ? `id:${e.id}` : null;
    return slot && slotIndex.has(slot) ? slot : `new:${j}`;
  });

  const currentMatched = new Set(currentSlots.filter((s) => !isNew(s)));

  // A replacement takes the slot of the row it replaced.
  const swapped = new Map<Slot, { o: number; c: number }>();
  current.forEach((e, c) => {
    if (!isNew(currentSlots[c]) || e.replacedFromId == null) return;
    const slot = `id:${e.replacedFromId}`;
    const o = slotIndex.get(slot);
    if (o === undefined || currentMatched.has(slot) || swapped.has(slot)) {
      return;
    }
    swapped.set(slot, { o, c });
    currentSlots[c] = slot;
  });
  const removed = new Map<Slot, number>();
  originalSlots.forEach((slot, o) => {
    if (!currentMatched.has(slot) && !swapped.has(slot)) removed.set(slot, o);
  });

  // A superset made in the session whose partner was then deleted is gone.
  const groupSizes = countGroups(current);
  const groupAfter = (e: UserExercise, before: string | null) => {
    const group = groupOf(e);
    return group && group !== before && groupSizes.get(group) === 1
      ? null
      : group;
  };

  const added = new Map<Slot, { c: number; links: Slot[] }>();
  current.forEach((_, c) => {
    if (isNew(currentSlots[c])) {
      added.set(currentSlots[c], { c, links: [] });
    }
  });

  const matched = new Map<
    Slot,
    { o: number; c: number; supersetDetail: boolean }
  >();
  const unlinked = new Map<string, Slot[]>();
  current.forEach((e, c) => {
    const slot = currentSlots[c];
    if (!currentMatched.has(slot)) return;
    const o = slotIndex.get(slot)!;
    const before = groupOf(original[o]);
    const after = groupAfter(e, before);
    let supersetDetail = false;
    if (before !== after) {
      const partner = after
        ? [...added.values()].find(
            (a) => current[a.c].supersetGroupId === after,
          )
        : undefined;
      if (partner) {
        partner.links.push(slot);
      } else if (before && !after) {
        unlinked.set(before, [...(unlinked.get(before) ?? []), slot]);
      } else {
        supersetDetail = true;
      }
    }
    matched.set(slot, { o, c, supersetDetail });
  });

  const kept = (slots: Slot[]) =>
    slots.filter((s) => matched.has(s) || swapped.has(s));
  const reordered =
    kept(originalSlots).join() !==
    kept(currentSlots.filter((s) => !isNew(s))).join();

  return {
    original,
    current,
    originalSlots,
    currentSlots,
    matched,
    removed,
    swapped,
    added,
    unlinked,
    reordered,
  };
}

/** The session's edits, in the original exercise order, additions last. */
export function diffWorkout(
  originalWorkout: Workout,
  currentWorkout: Workout,
): WorkoutChange[] {
  const a = analyse(originalWorkout, currentWorkout);
  const changes: WorkoutChange[] = [];
  const unlinksListed = new Set<string>();

  a.originalSlots.forEach((slot, o) => {
    const name = a.original[o].name;
    if (a.removed.has(slot)) {
      changes.push({ id: `remove:${slot}`, kind: "removed", name });
      return;
    }
    const swap = a.swapped.get(slot);
    if (swap) {
      const to = a.current[swap.c];
      const details = exerciseDetails(a.original[o], to);
      const sizes = countGroups(a.current);
      const toGroup =
        groupOf(to) && sizes.get(groupOf(to)!) === 2 ? groupOf(to) : null;
      if (groupOf(a.original[o]) !== toGroup) {
        details.push({ kind: "superset" });
      }
      changes.push({
        id: `swap:${slot}`,
        kind: "swapped",
        from: name,
        to: to.name,
        details,
      });
      return;
    }
    const match = a.matched.get(slot);
    if (!match) return;
    const details = exerciseDetails(a.original[o], a.current[match.c]);
    if (match.supersetDetail) details.push({ kind: "superset" });
    if (details.length > 0) {
      changes.push({ id: `modify:${slot}`, kind: "modified", name, details });
    }
    const group = groupOf(a.original[o]);
    if (group && a.unlinked.has(group) && !unlinksListed.has(group)) {
      unlinksListed.add(group);
      changes.push({
        id: `unlink:${group}`,
        kind: "unlinked",
        names: a.unlinked
          .get(group)!
          .map((s) => a.original[a.matched.get(s)!.o].name),
      });
    }
  });

  for (const [slot, { c, links }] of a.added) {
    const supersetWith = links[0]
      ? a.current[a.matched.get(links[0])!.c].name
      : undefined;
    changes.push({
      id: `add:${slot}`,
      kind: "added",
      name: a.current[c].name,
      ...(supersetWith ? { supersetWith } : {}),
    });
  }

  if (a.reordered) changes.push({ id: ORDER_ID, kind: "reordered" });
  return changes;
}

const copy = (e: UserExercise): UserExercise => JSON.parse(JSON.stringify(e));

const withGroup = (e: UserExercise, group: string | null): UserExercise => {
  const { supersetGroupId: _, ...rest } = e;
  return group ? { ...rest, supersetGroupId: group } : rest;
};

/**
 * The original exercises with only the chosen changes (ids from
 * diffWorkout) applied. A superset link left with one exercise is dropped.
 */
export function applyWorkoutChanges(
  originalWorkout: Workout,
  currentWorkout: Workout,
  chosenIds: Iterable<string>,
): UserExercise[] {
  const a = analyse(originalWorkout, currentWorkout);
  const chosen = new Set(chosenIds);

  let result = a.originalSlots.map((slot, o) => ({
    slot,
    exercise: copy(a.original[o]),
  }));
  const entry = (slot: Slot) => result.find((r) => r.slot === slot);

  for (const [slot, { c, supersetDetail }] of a.matched) {
    if (!chosen.has(`modify:${slot}`)) continue;
    const r = entry(slot)!;
    const next = copy(a.current[c]);
    r.exercise = supersetDetail ? next : withGroup(next, groupOf(r.exercise));
  }
  for (const [slot, { c }] of a.swapped) {
    if (chosen.has(`swap:${slot}`)) entry(slot)!.exercise = copy(a.current[c]);
  }
  for (const [group, slots] of a.unlinked) {
    if (!chosen.has(`unlink:${group}`)) continue;
    for (const slot of slots) {
      const r = entry(slot)!;
      r.exercise = withGroup(r.exercise, null);
    }
  }
  result = result.filter((r) => !chosen.has(`remove:${r.slot}`));

  // Each chosen addition goes after the exercise it followed in the session.
  for (const [slot, { c, links }] of a.added) {
    if (!chosen.has(`add:${slot}`)) continue;
    let at = 0;
    for (let j = c - 1; j >= 0; j--) {
      const i = result.findIndex((r) => r.slot === a.currentSlots[j]);
      if (i !== -1) {
        at = i + 1;
        break;
      }
    }
    const exercise = copy(a.current[c]);
    result.splice(at, 0, { slot, exercise });
    for (const link of links) {
      const r = entry(link)!;
      r.exercise = withGroup(r.exercise, groupOf(exercise));
    }
  }

  if (chosen.has(ORDER_ID)) {
    // The session's order; an exercise it no longer has stays behind the
    // one it followed before.
    const position = new Map(a.currentSlots.map((s, j) => [s, j]));
    const runs: { at: number; items: typeof result }[] = [];
    for (const r of result) {
      const at = position.get(r.slot);
      if (at !== undefined) runs.push({ at, items: [r] });
      else if (runs.length > 0) runs[runs.length - 1].items.push(r);
      else runs.push({ at: -1, items: [r] });
    }
    runs.sort((x, y) => x.at - y.at);
    result = runs.flatMap((run) => run.items);
  }

  // Every superset is a side-by-side pair; anything else is unlinked.
  const exercises = result.map(({ exercise }) => {
    const { replacedFromId: _, ...rest } = exercise;
    return rest as UserExercise;
  });
  const pairs = countGroups(exercises);
  return exercises.map((e, i) => {
    const group = groupOf(e);
    if (!group) return e;
    const prev = exercises[i - 1];
    const next = exercises[i + 1];
    const besideItsPartner =
      pairs.get(group) === 2 &&
      ((prev !== undefined && groupOf(prev) === group) ||
        (next !== undefined && groupOf(next) === group));
    return besideItsPartner ? e : withGroup(e, null);
  });
}
