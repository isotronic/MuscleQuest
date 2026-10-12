import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export type PlanLevel = "beginner" | "intermediate" | "advanced";
export type PlanGoal = "strength" | "muscle" | "general";
/** What a plan needs, from least to most: each level includes the ones before. */
export type PlanEquipment = "none" | "dumbbells" | "gym";

export const PLAN_LEVELS: PlanLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];
export const PLAN_EQUIPMENT: PlanEquipment[] = ["none", "dumbbells", "gym"];

export interface PremadePlanMeta {
  description: MessageDescriptor;
  level: PlanLevel;
  goal: PlanGoal;
  daysPerWeek: number;
  /** Typical session length, from the plan's duration estimate, rounded to 5. */
  sessionMinutes: number;
  equipment: PlanEquipment;
}

/**
 * Descriptions and facts for the premade plans, keyed by `app_plan_id`. Kept
 * in code so they translate and update with the bundle; user plans (no
 * `app_plan_id`) have none.
 */
export const PREMADE_PLAN_META: Record<number, PremadePlanMeta> = {
  1: {
    description: msg`For newer lifters who want to train the whole body three times a week. Each session pairs a few big barbell lifts with accessories, with a rest day in between.`,
    level: "beginner",
    goal: "general",
    daysPerWeek: 3,
    sessionMinutes: 75,
    equipment: "gym",
  },
  2: {
    description: msg`For lifters with some experience who want to get stronger in the big lifts. Four days a week alternate upper and lower body, mostly in sets of 6 to 8 reps.`,
    level: "intermediate",
    goal: "strength",
    daysPerWeek: 4,
    sessionMinutes: 60,
    equipment: "gym",
  },
  3: {
    description: msg`For lifters with some experience who like to focus on one area a day. Five days a week cover chest, back, shoulders, arms and legs once each.`,
    level: "intermediate",
    goal: "muscle",
    daysPerWeek: 5,
    sessionMinutes: 60,
    equipment: "gym",
  },
  4: {
    description: msg`For experienced lifters who can train six days a week. Push, pull and legs each come twice, with a different session the second time.`,
    level: "advanced",
    goal: "muscle",
    daysPerWeek: 6,
    sessionMinutes: 55,
    equipment: "gym",
  },
  5: {
    description: msg`For beginners training at home without equipment. Three days a week cover push, legs and pull, with core work along the way.`,
    level: "beginner",
    goal: "general",
    daysPerWeek: 3,
    sessionMinutes: 45,
    equipment: "none",
  },
  6: {
    description: msg`For training at home or in the gym with only dumbbells. Four days a week cover chest and triceps, back and biceps, legs, then shoulders and arms.`,
    level: "beginner",
    goal: "muscle",
    daysPerWeek: 4,
    sessionMinutes: 60,
    equipment: "dumbbells",
  },
  7: {
    description: msg`For lifters with some experience who want to build muscle over five days. Push, pull and legs come first, then an upper and a lower day finish the week.`,
    level: "intermediate",
    goal: "muscle",
    daysPerWeek: 5,
    sessionMinutes: 60,
    equipment: "gym",
  },
};

export function premadePlanMeta(
  appPlanId: number | null | undefined,
): PremadePlanMeta | null {
  return appPlanId == null ? null : (PREMADE_PLAN_META[appPlanId] ?? null);
}

export const PLAN_LEVEL_LABELS: Record<PlanLevel, MessageDescriptor> = {
  beginner: msg`Beginner`,
  intermediate: msg`Intermediate`,
  advanced: msg`Advanced`,
};

export const PLAN_GOAL_LABELS: Record<PlanGoal, MessageDescriptor> = {
  strength: msg`Strength`,
  muscle: msg`Muscle`,
  general: msg`General fitness`,
};

export const PLAN_EQUIPMENT_LABELS: Record<PlanEquipment, MessageDescriptor> = {
  gym: msg`Gym`,
  dumbbells: msg`Dumbbells`,
  none: msg`No equipment`,
};
