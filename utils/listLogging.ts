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

/**
 * The exercises as the overview lists them: each one once, a superset's two
 * together where the first of them appears. Each group is its exercise
 * indices.
 */
export function exerciseGroups(
  exercises: { supersetGroupId?: string | null }[],
): number[][] {
  const groups: number[][] = [];
  const seen = new Set<number>();
  exercises.forEach((exercise, i) => {
    if (seen.has(i)) return;
    seen.add(i);
    const partner = exercise.supersetGroupId
      ? exercises.findIndex(
          (e, j) => j !== i && e.supersetGroupId === exercise.supersetGroupId,
        )
      : -1;
    if (partner !== -1 && !seen.has(partner)) {
      seen.add(partner);
      groups.push([i, partner]);
    } else {
      groups.push([i]);
    }
  });
  return groups;
}

/** The group before or after the one holding `exerciseIndex`, or null. */
export function adjacentGroup(
  exercises: { supersetGroupId?: string | null }[],
  exerciseIndex: number,
  step: 1 | -1,
): number[] | null {
  const groups = exerciseGroups(exercises);
  const at = groups.findIndex((g) => g.includes(exerciseIndex));
  if (at === -1) return null;
  return groups[at + step] ?? null;
}
