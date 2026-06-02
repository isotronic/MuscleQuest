import { Set as PlanSet } from "@/store/workoutStore";
import {
  ProgressionAction,
  ProgressionEngineInputs,
  ProgressionRuleResult,
  UserProgressionIncrements,
} from "@/types/progression";

const RULE_EXPLANATIONS: Record<string, string> = {
  PAIN_BLOCK: "Pain reported. Keeping load unchanged until you feel better.",
  FAILED_SETS:
    "You couldn't complete all sets. Reducing load slightly for next time.",
  POOR_RECOVERY: "Still recovering. Hold this load for now.",
  BELOW_TARGET: "Rep target not met. Hold steady for now.",
  EASY_TARGET_LOAD:
    "You've been hitting targets easily. Time to add a little more weight.",
  EASY_TARGET_REPS: "Good pace. Try adding one more rep per set next session.",
  EASY_HOLD_REQUESTED: "You chose to keep it steady. Hold this load.",
  MODERATE_TARGET: "Solid session. Keep this load.",
  HARD_TARGET: "You finished everything at the limit. Stay here and own it.",
  UNSUPPORTED_TRACKING: "No progression tracking for this exercise type in v1.",
  NO_PRIOR_WEIGHT: "No prior weight data. Hold steady for now.",
  DEFAULT: "Hold steady this session.",
};

// Equipment strings as they appear in the database (lowercase)
const BARBELL_EQUIPMENT = ["barbell", "ez barbell", "trap bar"];
const DUMBBELL_EQUIPMENT = ["dumbbell"];
const CABLE_EQUIPMENT = ["cable", "rope"];
const MACHINE_EQUIPMENT = ["leverage machine", "smith machine", "sled machine"];

export function computeLoadIncrement(
  equipment: string,
  userIncrements: UserProgressionIncrements,
): number {
  const eq = equipment.toLowerCase();
  if (BARBELL_EQUIPMENT.includes(eq)) return userIncrements.barbellKg;
  if (DUMBBELL_EQUIPMENT.includes(eq)) return userIncrements.dumbbellKg;
  if (CABLE_EQUIPMENT.includes(eq)) return userIncrements.cableKg;
  if (MACHINE_EQUIPMENT.includes(eq)) return userIncrements.machineKg;
  return 0;
}

export function computeReducedLoad(currentWeight: number): number {
  if (currentWeight <= 0) return 0;
  const reduced = currentWeight * 0.95;
  const rounded = Math.floor(reduced / 0.5) * 0.5;
  return Math.max(0, Math.min(rounded, currentWeight - 0.5));
}

function getWorkingSets(sets: PlanSet[]): PlanSet[] {
  return sets.filter((s) => !s.isWarmup);
}

/**
 * Given completed reps per working set and the plan sets, computes per-set
 * suggested reps (+1 each, capped at repsMax).  Returns null if data is
 * missing or if every set has already reached its repsMax (load increase
 * should be suggested instead).
 */
function computePerSetRepTargets(
  workingSets: PlanSet[],
  completedRepsPerSet: (number | null)[],
): number[] | null {
  if (completedRepsPerSet.length < workingSets.length) return null;

  const suggested = workingSets.map((s, i) => {
    const actual = completedRepsPerSet[i] ?? 0;
    const cap = s.repsMax ?? Infinity;
    return Math.min(actual + 1, cap);
  });

  return suggested;
}

/**
 * Returns true when the first two working sets (or all sets if fewer than two)
 * were completed at or above their repsMax, meaning the next step should be to
 * increase load rather than reps.
 */
function firstTwoSetsAtMax(
  workingSets: PlanSet[],
  completedRepsPerSet: (number | null)[],
): boolean {
  if (completedRepsPerSet.length < workingSets.length) return false;
  const checkCount = Math.min(2, workingSets.length);
  for (let i = 0; i < checkCount; i++) {
    const actual = completedRepsPerSet[i] ?? 0;
    const max = workingSets[i].repsMax;
    if (max == null || actual < max) return false;
  }
  return true;
}

function hold(ruleKey: string): ProgressionRuleResult {
  return {
    action: "hold" as ProgressionAction,
    ruleKey,
    explanation: RULE_EXPLANATIONS[ruleKey] ?? RULE_EXPLANATIONS.DEFAULT,
  };
}

export function evaluateProgression(
  inputs: ProgressionEngineInputs,
): ProgressionRuleResult {
  const {
    trackingType,
    equipment,
    currentSets,
    recentWorkingWeight,
    latestFeedback,
    recoveryRating,
    consecutiveDirectionCount,
    userIncrements,
    completedRepsPerSet,
  } = inputs;

  // Unsupported tracking types
  if (trackingType === "time" || trackingType === "distance") {
    return hold("UNSUPPORTED_TRACKING");
  }

  // Rule 1: Pain blocks everything
  if (latestFeedback.painFlag === "pain") {
    return hold("PAIN_BLOCK");
  }

  // Rule 2: Failed sets — reduce load (immediate, no consecutive wait)
  if (latestFeedback.effortRating === "failed") {
    if (trackingType === "reps") {
      return hold("FAILED_SETS");
    }
    if (recentWorkingWeight === null) {
      return hold("NO_PRIOR_WEIGHT");
    }
    return {
      action: "reduce_load",
      ruleKey: "FAILED_SETS",
      explanation: RULE_EXPLANATIONS.FAILED_SETS,
      suggestedWeight: computeReducedLoad(recentWorkingWeight),
    };
  }

  // Rule 3: Poor recovery — hold
  if (recoveryRating === "sore") {
    return hold("POOR_RECOVERY");
  }

  // Rule 4: Below target — hold
  if (latestFeedback.performanceRatio < 0.85) {
    return hold("BELOW_TARGET");
  }

  // Rules 5-6: Easy + on target
  if (
    latestFeedback.effortRating === "easy" &&
    latestFeedback.performanceRatio >= 1.0
  ) {
    if (latestFeedback.progressionIntent === "hold") {
      return hold("EASY_HOLD_REQUESTED");
    }

    if (consecutiveDirectionCount >= 1) {
      const workingSets = getWorkingSets(currentSets);
      const completed = completedRepsPerSet ?? [];

      // For weight/assisted: check if all sets are at the rep ceiling → load up
      if (trackingType === "weight" || trackingType === "assisted") {
        if (firstTwoSetsAtMax(workingSets, completed)) {
          // All sets hit repsMax → increase load instead of reps
          const increment = computeLoadIncrement(equipment, userIncrements);
          if (increment === 0) {
            return hold("UNSUPPORTED_TRACKING");
          }
          if (recentWorkingWeight === null) {
            return hold("NO_PRIOR_WEIGHT");
          }
          return {
            action: "increase_load",
            ruleKey: "EASY_TARGET_LOAD",
            explanation: RULE_EXPLANATIONS.EASY_TARGET_LOAD,
            suggestedWeight: recentWorkingWeight + increment,
          };
        }

        // Not all at max — suggest per-set rep targets
        const perSetTargets = computePerSetRepTargets(workingSets, completed);
        if (perSetTargets !== null) {
          return {
            action: "increase_reps",
            ruleKey: "EASY_TARGET_REPS",
            explanation: RULE_EXPLANATIONS.EASY_TARGET_REPS,
            suggestedRepsPerSet: perSetTargets,
          };
        }

        // No completed rep data — fall back to load increase
        const increment = computeLoadIncrement(equipment, userIncrements);
        if (increment === 0) {
          return hold("UNSUPPORTED_TRACKING");
        }
        if (recentWorkingWeight === null) {
          return hold("NO_PRIOR_WEIGHT");
        }
        return {
          action: "increase_load",
          ruleKey: "EASY_TARGET_LOAD",
          explanation: RULE_EXPLANATIONS.EASY_TARGET_LOAD,
          suggestedWeight: recentWorkingWeight + increment,
        };
      }

      // For reps-only tracking: always suggest more reps (no load to increase)
      if (trackingType === "reps") {
        if (firstTwoSetsAtMax(workingSets, completed)) {
          return hold("DEFAULT");
        }
        const perSetTargets = computePerSetRepTargets(workingSets, completed);
        if (perSetTargets !== null) {
          return {
            action: "increase_reps",
            ruleKey: "EASY_TARGET_REPS",
            explanation: RULE_EXPLANATIONS.EASY_TARGET_REPS,
            suggestedRepsPerSet: perSetTargets,
          };
        }
        return hold("DEFAULT");
      }
    }
  }

  // Rule 7: Moderate + on target — hold
  if (
    latestFeedback.effortRating === "moderate" &&
    latestFeedback.performanceRatio >= 1.0
  ) {
    return hold("MODERATE_TARGET");
  }

  // Rule 8: Hard + on target — hold
  if (
    latestFeedback.effortRating === "hard" &&
    latestFeedback.performanceRatio >= 1.0
  ) {
    return hold("HARD_TARGET");
  }

  return hold("DEFAULT");
}
