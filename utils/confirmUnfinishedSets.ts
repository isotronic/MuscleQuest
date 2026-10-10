import { Alert } from "react-native";
import { t, plural } from "@lingui/core/macro";

export interface UnfinishedExercise {
  name: string;
  count: number;
}

// The dialog names this many exercises, then says how many more there are.
const LISTED = 3;

/**
 * The planned sets not marked complete, per exercise in workout order. The
 * save keeps completed sets only, so these are what Finish would drop.
 */
export function findUnfinishedSets(
  exercises: { name: string; sets: unknown[] }[],
  completedSets: { [exerciseIndex: number]: { [setIndex: number]: boolean } },
): UnfinishedExercise[] {
  return exercises
    .map((exercise, exerciseIndex) => ({
      name: exercise.name,
      count: exercise.sets.filter(
        (_, setIndex) => completedSets[exerciseIndex]?.[setIndex] !== true,
      ).length,
    }))
    .filter((exercise) => exercise.count > 0);
}

export function unfinishedSetsMessage(
  unfinished: UnfinishedExercise[],
): string {
  const total = unfinished.reduce((sum, exercise) => sum + exercise.count, 0);
  const named = unfinished
    .slice(0, LISTED)
    .map(({ name, count }) => `${name} ${count}`)
    .join(", ");
  const more = unfinished.length - LISTED;
  const list = more > 0 ? t`${named} and ${more} more` : named;
  return plural(total, {
    one: `# set not completed (${list}). It will not be saved.`,
    other: `# sets not completed (${list}). They will not be saved.`,
  });
}

/**
 * Asks before finishing a workout with sets left undone. Calls onFinish
 * straight away when there are none; "Go back" keeps the session as it is.
 */
export function confirmUnfinishedSets(
  unfinished: UnfinishedExercise[],
  onFinish: () => void,
): void {
  if (unfinished.length === 0) {
    onFinish();
    return;
  }
  Alert.alert(t`Finish workout?`, unfinishedSetsMessage(unfinished), [
    { text: t`Go back`, style: "cancel" },
    { text: t`Finish anyway`, onPress: onFinish },
  ]);
}
