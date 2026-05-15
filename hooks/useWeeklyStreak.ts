import { useState, useEffect } from "react";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import {
  getWeeklyCompletions,
  upsertWeeklyCompletion,
} from "@/utils/database";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";

const syncWeeklyCompletions = async (
  allCompletedWorkouts: CompletedWorkout[],
  weeklyGoal: number,
  uniqueWorkoutDaysCount: number,
  weeklyGoalReached: boolean,
) => {
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Record current week immediately if goal is reached (locks in goal value)
  if (weeklyGoalReached) {
    await upsertWeeklyCompletion(
      format(currentWeekStart, "yyyy-MM-dd"),
      weeklyGoal,
      uniqueWorkoutDaysCount,
      true,
    );
  }

  // Check if last week needs recording (one week lookback only)
  const lastWeekStart = subWeeks(currentWeekStart, 1);
  const lastWeekStartStr = format(lastWeekStart, "yyyy-MM-dd");
  const existing = await getWeeklyCompletions();
  const lastWeekExists = existing.some((e) => e.week_start === lastWeekStartStr);

  if (!lastWeekExists) {
    const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
    const lastWeekWorkouts = allCompletedWorkouts.filter((w) => {
      const d = new Date(w.date_completed);
      return d >= lastWeekStart && d <= lastWeekEnd;
    });
    const uniqueDays = new Set(
      lastWeekWorkouts.map((w) => new Date(w.date_completed).toDateString()),
    ).size;
    await upsertWeeklyCompletion(
      lastWeekStartStr,
      weeklyGoal,
      uniqueDays,
      uniqueDays >= weeklyGoal,
    );
  }
};

const computeStreak = (
  completions: Awaited<ReturnType<typeof getWeeklyCompletions>>,
): number => {
  const sorted = [...completions].sort(
    (a, b) => b.week_start.localeCompare(a.week_start),
  );
  let streak = 0;
  for (const entry of sorted) {
    if (entry.goal_reached) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export function useWeeklyStreak(
  allCompletedWorkouts: CompletedWorkout[] | undefined,
  weeklyGoal: number,
  uniqueWorkoutDaysCount: number,
  weeklyGoalReached: boolean,
): { streak: number; loading: boolean } {
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allCompletedWorkouts) return;

    let cancelled = false;
    (async () => {
      try {
        await syncWeeklyCompletions(
          allCompletedWorkouts,
          weeklyGoal,
          uniqueWorkoutDaysCount,
          weeklyGoalReached,
        );
        const completions = await getWeeklyCompletions();
        if (!cancelled) {
          setStreak(computeStreak(completions));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allCompletedWorkouts, weeklyGoal, uniqueWorkoutDaysCount, weeklyGoalReached]);

  return { streak, loading };
}
