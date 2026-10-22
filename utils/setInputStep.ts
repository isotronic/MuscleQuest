// The +/- buttons on the set inputs. Both return canonical strings, the form
// the inputs and the store hold, never display text.

/** Reps after a step, never below zero; empty or invalid counts as zero. */
export function stepReps(reps: string, amount: number): string {
  const currentReps = isNaN(parseInt(reps)) ? 0 : parseInt(reps);
  return Math.max(0, currentReps + amount).toString();
}

/** Distance after a step, one decimal, never below zero. */
export function stepDistance(distance: string, amount: number): string {
  const currentDistance = isNaN(parseFloat(distance))
    ? 0
    : parseFloat(distance);
  return Math.max(0, currentDistance + amount).toFixed(1);
}
