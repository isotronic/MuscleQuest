import { UserExercise } from "@/store/workoutStore";

/**
 * Returns the index of the superset partner of the exercise at `index`,
 * or -1 if the exercise is not in a superset.
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
