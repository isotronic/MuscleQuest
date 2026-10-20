import { computeBestAchievement } from "@/components/WeeklySummaryCard";
import {
  DEFAULT_WEEK_RULE,
  startOfAppWeek,
  startOfPreviousAppWeek,
} from "@/utils/week";
import { toLocalDateKey } from "@/utils/dates";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
  plural: () => "",
}));
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("@lingui/react/macro", () => ({
  Trans: () => null,
  Plural: () => null,
}));

const assistedWorkout = (
  id: number,
  day: Date,
  bodyWeightKg: number,
  assistance: number,
): CompletedWorkout => ({
  id,
  workout_id: 1,
  plan_id: 1,
  workout_name: "Pull day",
  date_completed: day.toISOString(),
  local_date: toLocalDateKey(day),
  duration: 1800,
  total_sets_completed: 1,
  body_weight_kg: bodyWeightKg,
  exercises: [
    {
      completed_exercise_id: id,
      exercise_id: 9,
      exercise_name: "Assisted pull-up",
      exercise_tracking_type: "assisted",
      sets: [
        {
          set_id: id,
          set_number: 1,
          weight: assistance,
          reps: 8,
          time: null,
          distance: null,
          is_warmup: false,
          set_duration: null,
        },
      ],
    },
  ],
});

describe("computeBestAchievement", () => {
  it("judges assisted sets by the body weight of each workout, not today's", () => {
    const today = new Date();
    const lastWeek = startOfPreviousAppWeek(today, DEFAULT_WEEK_RULE);
    const thisWeek = startOfAppWeek(today, DEFAULT_WEEK_RULE);
    // 90 kg - 30 kg assistance last week, 80 kg - 20 kg this week: the same
    // 60 kg moved, so no gain. Today's 80 kg for both would show +20%.
    const last = assistedWorkout(1, lastWeek, 90, 30);
    const current = assistedWorkout(2, thisWeek, 80, 20);

    expect(computeBestAchievement([current], [current, last], "kg")).toBeNull();
  });
});
