import { useCallback, useEffect, useRef, useState } from "react";
import { WorkoutChangesDialog } from "@/components/WorkoutChangesDialog";
import type { WorkoutChange } from "@/utils/workoutChanges";

export interface ChangesQuestion {
  changes: WorkoutChange[];
  isPlan: boolean;
}

/** Resolves with the chosen change ids, or null to keep the workout. */
export type AskWhichChanges = (
  question: ChangesQuestion,
) => Promise<string[] | null>;

/**
 * The finish-workout question as a promise: `ask` opens the changes dialog
 * and settles when the user answers. Render `prompt` once on the screen.
 */
export function useWorkoutChangesPrompt() {
  const [question, setQuestion] = useState<ChangesQuestion | null>(null);
  // Kept after closing so the list does not empty while the modal fades.
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((ids: string[] | null) => void) | null>(null);

  const ask = useCallback<AskWhichChanges>(
    (next) =>
      new Promise((resolve) => {
        // A question still open is answered "keep" rather than left hanging.
        resolveRef.current?.(null);
        resolveRef.current = resolve;
        setQuestion(next);
        setOpen(true);
      }),
    [],
  );

  const onDone = useCallback((ids: string[] | null) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    resolve?.(ids);
  }, []);

  // Leaving the screen with the question open counts as keep, so the
  // caller's continuation is not left waiting.
  useEffect(() => () => resolveRef.current?.(null), []);

  const prompt = (
    <WorkoutChangesDialog
      visible={open}
      isPlan={question?.isPlan ?? false}
      changes={question?.changes ?? EMPTY}
      onDone={onDone}
    />
  );

  return { ask, prompt };
}

const EMPTY: WorkoutChange[] = [];
