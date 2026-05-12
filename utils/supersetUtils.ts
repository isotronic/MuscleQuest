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

/**
 * Reorders exercises while preserving superset adjacency invariants.
 * Returns a new array; the input is not mutated.
 */
export function reorderWithSupersetRules(
  exercises: UserExercise[],
  fromIndex: number,
  toIndex: number,
): UserExercise[] {
  if (fromIndex === toIndex) return exercises;

  const updated = [...exercises];
  const draggedExercise = updated[fromIndex];
  const { supersetGroupId } = draggedExercise;

  // Pre-compute original partner index before any mutations
  const originalPartnerIndex = findSupersetPartnerIndex(exercises, fromIndex);
  const isDraggingFirst =
    originalPartnerIndex !== -1 && fromIndex < originalPartnerIndex;

  // Standard single-item move
  const [movedItem] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, movedItem);

  if (supersetGroupId) {
    const draggedNewIdx = updated.findIndex(
      (e) => e.exercise_id === draggedExercise.exercise_id,
    );
    const partnerNewIdx = updated.findIndex(
      (e) =>
        e.exercise_id !== draggedExercise.exercise_id &&
        e.supersetGroupId === supersetGroupId,
    );

    // If already adjacent the drag resulted in a natural swap — leave as-is
    if (partnerNewIdx !== -1 && Math.abs(draggedNewIdx - partnerNewIdx) !== 1) {
      const [partner] = updated.splice(partnerNewIdx, 1);
      const newDraggedIdx = updated.findIndex(
        (e) => e.exercise_id === draggedExercise.exercise_id,
      );
      updated.splice(
        isDraggingFirst ? newDraggedIdx + 1 : newDraggedIdx,
        0,
        partner,
      );
    }
  } else {
    // Non-superset exercise: check if it landed between two superset partners
    const landedIdx = updated.findIndex(
      (e) => e.exercise_id === draggedExercise.exercise_id,
    );
    const prevItem = landedIdx > 0 ? updated[landedIdx - 1] : null;
    const nextItem =
      landedIdx < updated.length - 1 ? updated[landedIdx + 1] : null;

    if (
      prevItem?.supersetGroupId &&
      nextItem?.supersetGroupId &&
      prevItem.supersetGroupId === nextItem.supersetGroupId
    ) {
      updated.splice(landedIdx, 1);
      const secondPartnerIdx = updated.findIndex(
        (e) => e.exercise_id === nextItem.exercise_id,
      );
      updated.splice(secondPartnerIdx + 1, 0, draggedExercise);
    }
  }

  // Final pass: ensure all superset pairs are adjacent
  // (a drag can split an unrelated pair)
  const groupsSeen = new Set<string>();
  for (let i = 0; i < updated.length; i++) {
    const gid = updated[i].supersetGroupId;
    if (!gid || groupsSeen.has(gid)) continue;
    groupsSeen.add(gid);
    const partnerIdx = updated.findIndex(
      (e, j) => j > i && e.supersetGroupId === gid,
    );
    if (partnerIdx === -1 || partnerIdx === i + 1) continue;
    const [partner] = updated.splice(partnerIdx, 1);
    updated.splice(i + 1, 0, partner);
  }

  return updated;
}
