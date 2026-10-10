import type { SavedWorkout } from "@/utils/database";
import type { UserExercise } from "@/store/workoutStore";
import { convertTimeStrToSeconds } from "@/utils/utility";

type SetEntry = {
  weight?: string;
  reps?: string;
  time?: string;
  distance?: string;
};

/**
 * The in-progress session as the completed-workout save expects it: only
 * completed sets, in display units, with their set notes. Exercises with no
 * completed set are left out.
 */
interface SessionSnapshot {
  exercises: UserExercise[];
  completedSets: { [exerciseIndex: number]: { [setIndex: number]: boolean } };
  weightAndReps: { [exerciseIndex: number]: { [setIndex: number]: SetEntry } };
  setDurations: {
    [exerciseIndex: number]: { [setIndex: number]: number | null };
  };
  setNotes: { [exerciseIndex: number]: { [setIndex: number]: string } };
}

export function buildCompletedExercises(
  session: SessionSnapshot,
): SavedWorkout["exercises"] {
  const { exercises, completedSets, weightAndReps, setDurations, setNotes } =
    session;
  return exercises
    .map((exercise, index) => {
      const completedSetIndices = Object.entries(completedSets[index] || {})
        .filter(([, isCompleted]) => isCompleted)
        .map(([setIndex]) => parseInt(setIndex));

      if (completedSetIndices.length === 0) {
        return null;
      }

      const sets = Object.entries(weightAndReps[index] || {})
        .filter(([setIndex]) =>
          completedSetIndices.includes(parseInt(setIndex)),
        )
        .map(([setIndex, set]) => ({
          set_number: parseInt(setIndex) + 1,
          weight: set.weight ? parseFloat(set.weight) : null,
          reps: set.reps ? parseInt(set.reps) : null,
          time: set.time ? convertTimeStrToSeconds(set.time) : null,
          distance:
            set.distance !== "" && set.distance != null
              ? parseFloat(set.distance)
              : null,
          is_warmup: exercise.sets[parseInt(setIndex)]?.isWarmup || false,
          is_drop_set: exercise.sets[parseInt(setIndex)]?.isDropSet || false,
          is_to_failure:
            exercise.sets[parseInt(setIndex)]?.isToFailure || false,
          set_duration: setDurations?.[index]?.[parseInt(setIndex)] ?? null,
          note: setNotes?.[index]?.[parseInt(setIndex)] ?? null,
        }));

      return {
        exercise_id: exercise.exercise_id,
        resolved_tracking_type:
          exercise.tracking_type_override ?? exercise.tracking_type ?? null,
        sets,
      };
    })
    .filter((exercise) => exercise !== null);
}

const isSaved = (session: SessionSnapshot, exIdx: number, setIdx: number) =>
  session.completedSets[exIdx]?.[setIdx] === true &&
  session.weightAndReps[exIdx]?.[setIdx] !== undefined;

/**
 * Notes on sets that buildCompletedExercises leaves out (never completed), so
 * the caller can keep them in the session note instead of dropping them.
 */
export function unsavedSetNotes(
  session: SessionSnapshot,
): { exerciseName: string; setNumber: number; note: string }[] {
  const result: { exerciseName: string; setNumber: number; note: string }[] =
    [];
  session.exercises.forEach((exercise, exIdx) => {
    Object.entries(session.setNotes[exIdx] ?? {})
      .map(([key, note]) => [parseInt(key, 10), note.trim()] as const)
      .filter(([setIdx, note]) => note && !isSaved(session, exIdx, setIdx))
      .sort(([a], [b]) => a - b)
      .forEach(([setIdx, note]) =>
        result.push({
          exerciseName: exercise.name,
          setNumber: setIdx + 1,
          note,
        }),
      );
  });
  return result;
}
