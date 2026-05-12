import { UserExercise } from "@/store/workoutStore";

/**
 * Asserts that every `supersetGroupId` present in `exercises` appears exactly
 * twice — one occurrence per exercise in the pair. Throws a `RangeError`
 * naming the offending `supersetGroupId` if the cardinality constraint is
 * violated.
 *
 * Call this after loading or mutating workout exercises so that
 * {@link findSupersetPartnerIndex} can rely on the invariant being satisfied.
 */
export function validateSupersetCardinality(exercises: UserExercise[]): void {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    if (e.supersetGroupId) {
      counts.set(e.supersetGroupId, (counts.get(e.supersetGroupId) ?? 0) + 1);
    }
  }
  for (const [id, count] of counts) {
    if (count !== 2) {
      throw new RangeError(
        `supersetGroupId "${id}" appears ${count} time(s) in exercises; ` +
          `expected exactly 2. Check the data passed to findSupersetPartnerIndex.`,
      );
    }
  }
}

/**
 * Returns the index of the superset partner of the exercise at `index`,
 * or -1 if the exercise is not in a superset.
 *
 * **Cardinality contract**: each `supersetGroupId` must appear exactly twice in
 * `exercises` (one entry per exercise in the pair). If the group contains fewer
 * or more than two exercises the data is corrupt; use
 * {@link validateSupersetCardinality} after loading exercises to enforce this
 * invariant before calling this function.
 */
export function findSupersetPartnerIndex(
  exercises: UserExercise[],
  index: number,
): number {
  const supersetGroupId = exercises[index]?.supersetGroupId;
  if (!supersetGroupId) return -1;

  return exercises.findIndex(
    (e, i) => i !== index && e.supersetGroupId === supersetGroupId,
  );
}

/**
 * Returns superset position flags for the exercise at `index`.
 */
export function classifySupersetPosition(
  exercises: UserExercise[],
  index: number,
): {
  isInSuperset: boolean;
  partnerIndex: number;
  isFirstInSuperset: boolean;
  isSecondInSuperset: boolean;
} {
  const partnerIndex = findSupersetPartnerIndex(exercises, index);
  const isInSuperset = partnerIndex !== -1;

  return {
    isInSuperset,
    partnerIndex,
    isFirstInSuperset: isInSuperset && index < partnerIndex,
    isSecondInSuperset: isInSuperset && index > partnerIndex,
  };
}
