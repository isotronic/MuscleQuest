import {
  PLAN_EQUIPMENT,
  PLAN_LEVELS,
  type PlanEquipment,
  type PlanLevel,
  type PremadePlanMeta,
} from "@/constants/premadePlanMeta";

export interface PlanPickerAnswers {
  /** Training days available each week, 2 to 6. */
  days: number;
  level: PlanLevel;
  /** The most the user has access to. */
  equipment: PlanEquipment;
}

export interface RankedPlan {
  appPlanId: number;
  /** Which answers the plan matches exactly, for the one-line reason. */
  matches: { days: boolean; level: boolean; equipment: boolean };
}

/**
 * Ranks premade plans for the "Help me choose" answers, best first.
 *
 * A plan that needs equipment the user lacks ranks after every plan they can
 * do. Then: days closest to what is available (a plan with more days than
 * that counts double, since it cannot be done in full), level closest, the
 * exact equipment, and finally plan id so the order is stable.
 */
export function rankPremadePlans(
  answers: PlanPickerAnswers,
  meta: Record<number, PremadePlanMeta>,
): RankedPlan[] {
  const userLevel = PLAN_LEVELS.indexOf(answers.level);
  const userEquipment = PLAN_EQUIPMENT.indexOf(answers.equipment);

  const scored = Object.entries(meta).map(([id, m]) => {
    const extraDays = m.daysPerWeek - answers.days;
    return {
      appPlanId: Number(id),
      unusable: PLAN_EQUIPMENT.indexOf(m.equipment) > userEquipment ? 1 : 0,
      dayCost: extraDays > 0 ? extraDays * 2 : -extraDays,
      levelCost: Math.abs(PLAN_LEVELS.indexOf(m.level) - userLevel),
      equipmentMiss: m.equipment === answers.equipment ? 0 : 1,
      matches: {
        days: extraDays === 0,
        level: m.level === answers.level,
        equipment: m.equipment === answers.equipment,
      },
    };
  });

  scored.sort(
    (a, b) =>
      a.unusable - b.unusable ||
      a.dayCost - b.dayCost ||
      a.levelCost - b.levelCost ||
      a.equipmentMiss - b.equipmentMiss ||
      a.appPlanId - b.appPlanId,
  );

  return scored.map(({ appPlanId, matches }) => ({ appPlanId, matches }));
}
