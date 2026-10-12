import { useState, useEffect } from "react";
import { getWeeklyCompletions, upsertWeeklyCompletion } from "@/utils/database";
import { toLocalDateKey } from "@/utils/dates";
import {
  countTrainingDaysInWeek,
  previousWeekStartKey,
  weekEndKey,
  weekStartKeyFor,
  type WeekRule,
} from "@/utils/week";

// Only the training day of each workout matters here, and only for last
// week, so callers can pass a recent window rather than the whole history.
type DatedWorkout = { local_date: string };

const syncWeeklyCompletions = async (
  allCompletedWorkouts: readonly DatedWorkout[],
  weeklyGoal: number,
  uniqueWorkoutDaysCount: number,
  weeklyGoalReached: boolean,
  rule: WeekRule,
) => {
  const currentWeekStart = weekStartKeyFor(toLocalDateKey(new Date()), rule);

  // Record current week immediately if goal is reached (locks in goal value)
  if (weeklyGoalReached) {
    await upsertWeeklyCompletion(
      currentWeekStart,
      weeklyGoal,
      uniqueWorkoutDaysCount,
      true,
    );
  }

  // Record last week once it is over (one week lookback only). A recorded week
  // is recounted if a stale workout saved later landed in it, keeping the goal
  // that was recorded. Stepping back through the week rule finds the
  // transition week after a change of week start, so the streak joins the
  // old and new weeks without a gap.
  const lastWeekStartStr = previousWeekStartKey(currentWeekStart, rule);
  const existing = await getWeeklyCompletions();
  const lastWeekRow = existing.find((e) => e.week_start === lastWeekStartStr);

  // local_date is the training day as it was when the workout was logged, so
  // a week's count does not change if the user later travels.
  const uniqueDays = countTrainingDaysInWeek(
    allCompletedWorkouts,
    lastWeekStartStr,
    rule,
  );

  // Only the last change of week start is remembered, so after two close
  // together last week can come out overlapping a week already recorded
  // under the older rule. Leave it to that row rather than count days twice.
  const lastWeekEnd = weekEndKey(lastWeekStartStr, rule);
  const overlapsRecorded = existing.some(
    (e) =>
      e.week_start !== lastWeekStartStr &&
      e.week_start >= lastWeekStartStr &&
      e.week_start <= lastWeekEnd,
  );

  if (!lastWeekRow && !overlapsRecorded) {
    await upsertWeeklyCompletion(
      lastWeekStartStr,
      weeklyGoal,
      uniqueDays,
      uniqueDays >= weeklyGoal,
    );
  } else if (lastWeekRow && uniqueDays > lastWeekRow.completed) {
    await upsertWeeklyCompletion(
      lastWeekStartStr,
      lastWeekRow.goal,
      uniqueDays,
      uniqueDays >= lastWeekRow.goal,
    );
  }
};

const computeStreak = (
  completions: Awaited<ReturnType<typeof getWeeklyCompletions>>,
): number => {
  const sorted = [...completions].sort((a, b) =>
    b.week_start.localeCompare(a.week_start),
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
  allCompletedWorkouts: readonly DatedWorkout[] | undefined,
  weeklyGoal: number,
  uniqueWorkoutDaysCount: number,
  weeklyGoalReached: boolean,
  weekRule: WeekRule,
): { streak: number; loading: boolean } {
  const [streak, setStreak] = useState(0);
  // Compared by value so a rule rebuilt on each render does not re-run it.
  const { weekStartsOn, previous, from } = weekRule;
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
          { weekStartsOn, previous, from },
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
  }, [
    allCompletedWorkouts,
    weeklyGoal,
    uniqueWorkoutDaysCount,
    weeklyGoalReached,
    weekStartsOn,
    previous,
    from,
  ]);

  return { streak, loading };
}
