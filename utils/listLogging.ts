export type ListRow = { exerciseIndex: number; setIndex: number };

/**
 * The rows the list logging mode shows, in order: one exercise's sets, or a
 * superset's sets interleaved by round.
 */
export function listRows(
  setCounts: number[],
  exerciseIndices: number[],
): ListRow[] {
  const rounds = Math.max(0, ...setCounts);
  const rows: ListRow[] = [];
  for (let setIndex = 0; setIndex < rounds; setIndex++) {
    exerciseIndices.forEach((exerciseIndex, i) => {
      if (setIndex < setCounts[i]) rows.push({ exerciseIndex, setIndex });
    });
  }
  return rows;
}
