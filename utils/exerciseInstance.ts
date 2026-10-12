import { formatGroupedInteger } from "@/utils/numberFormat";

/**
 * Which instance of its exercise the row at `index` is: 0 for the first time
 * the exercise appears in the workout, 1 for the second, and so on.
 */
export function occurrenceIndex(
  exercises: readonly { exercise_id: number }[],
  index: number,
): number {
  const id = exercises[index]?.exercise_id;
  return exercises.slice(0, index).filter((e) => e.exercise_id === id).length;
}

/**
 * The row's exercise name, with "(2)", "(3)" ... after a repeat of an
 * exercise already in the workout, so two blocks of squats can be told apart.
 */
export function instanceName(
  exercises: readonly { exercise_id: number }[],
  index: number,
  name: string,
): string {
  const occurrence = occurrenceIndex(exercises, index);
  return occurrence === 0
    ? name
    : `${name} (${formatGroupedInteger(occurrence + 1)})`;
}
