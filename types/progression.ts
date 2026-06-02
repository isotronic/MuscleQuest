import { Set as PlanSet } from "@/store/workoutStore";

export type EffortRating = "easy" | "moderate" | "hard" | "failed";
export type PainFlag = "none" | "discomfort" | "pain";
export type RecoveryRating = "fresh" | "mild" | "sore";
export type ProgressionAction =
  | "increase_load"
  | "increase_reps"
  | "hold"
  | "reduce_load"
  | "add_set"
  | "remove_set";

export interface UserProgressionIncrements {
  barbellKg: number;
  dumbbellKg: number;
  cableKg: number;
  machineKg: number;
}

export interface ExerciseFeedbackPayload {
  userWorkoutExerciseId: number;
  effortRating: EffortRating;
  painFlag: PainFlag;
  progressionIntent?: "progress" | "hold";
  performanceRatio: number;
  notes?: string;
}

export interface ExerciseFeedback {
  id: number;
  effortRating: EffortRating;
  painFlag: PainFlag;
  progressionIntent?: "progress" | "hold";
  performanceRatio: number;
  createdAt: string;
}

export interface RecoveryCheckInPayload {
  userWorkoutExerciseId: number;
  exerciseId: number;
  recoveryRating: RecoveryRating;
}

export interface ProgressionEngineInputs {
  userWorkoutExerciseId: number;
  exerciseId: number;
  trackingType: string;
  equipment: string;
  currentSets: PlanSet[];
  recentWorkingWeight: number | null;
  latestFeedback: ExerciseFeedbackPayload;
  priorFeedbackHistory: ExerciseFeedback[];
  recoveryRating: RecoveryRating | null;
  consecutiveDirectionCount: number;
  userIncrements: UserProgressionIncrements;
  /** Actual reps completed per working set (non-warmup), in order. */
  completedRepsPerSet?: (number | null)[];
}

export interface ProgressionRuleResult {
  action: ProgressionAction;
  ruleKey: string;
  explanation: string;
  suggestedWeight?: number;
  /** Per-set suggested rep targets (one per working set, in order). */
  suggestedRepsPerSet?: number[];
  suggestedSets?: number;
}

export interface ExerciseProgressionState {
  id: number;
  userWorkoutExerciseId: number;
  suggestionAction: ProgressionAction;
  suggestedWeight?: number;
  /** Per-set suggested rep targets (one per working set, in order). */
  suggestedRepsPerSet?: number[];
  suggestedSets?: number;
  ruleKey: string;
  ruleExplanation: string;
  sourceFeedbackId?: number;
  recoveryRating?: RecoveryRating;
  recoveryCheckedAt?: string;
  consecutiveDirectionCount: number;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: string;
  updatedAt: string;
}
