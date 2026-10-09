import { renderHook, waitFor } from "@testing-library/react-native";
import { useWeeklyStreak } from "../useWeeklyStreak";
import { getWeeklyCompletions, upsertWeeklyCompletion } from "@/utils/database";
import { startOfWeek, subWeeks, endOfWeek, format } from "date-fns";
import { toLocalDateKey } from "@/utils/dates";
import type { CompletedWorkout } from "../useCompletedWorkoutsQuery";

jest.mock("@/utils/database", () => ({
  getWeeklyCompletions: jest.fn(),
  upsertWeeklyCompletion: jest.fn(),
}));

// A workout trained late on `day` while the user was 13 hours ahead, who has
// since flown home. The stored instant now renders as the *next* local day, so
// anything deriving the training day from date_completed puts it in the wrong
// week; local_date is fixed at what it was when they trained.
const makeTravelledWorkout = (day: Date): Partial<CompletedWorkout> => {
  const renderedLocally = new Date(day);
  renderedLocally.setDate(renderedLocally.getDate() + 1);
  renderedLocally.setHours(2, 30, 0, 0);
  return {
    id: day.getTime(),
    date_completed: renderedLocally.toISOString(),
    local_date: toLocalDateKey(day),
  };
};

// An ordinary workout, trained and read in the same timezone.
const makeWorkout = (day: Date): Partial<CompletedWorkout> => {
  const finishedAt = new Date(day);
  finishedAt.setHours(18, 0, 0, 0);
  return {
    id: day.getTime(),
    date_completed: finishedAt.toISOString(),
    local_date: toLocalDateKey(finishedAt),
  };
};

describe("useWeeklyStreak", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (upsertWeeklyCompletion as jest.Mock).mockResolvedValue(undefined);
  });

  it("does not run and loading remains true when allCompletedWorkouts is undefined", () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    const { result } = renderHook(() =>
      useWeeklyStreak(undefined, 3, 0, false),
    );
    expect(result.current.loading).toBe(true);
    expect(getWeeklyCompletions).not.toHaveBeenCalled();
  });

  it("sets loading to false after sync completes", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    const workouts: never[] = [];
    const { result } = renderHook(() => useWeeklyStreak(workouts, 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("returns streak = 0 when there are no completions", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    const workouts: never[] = [];
    const { result } = renderHook(() => useWeeklyStreak(workouts, 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streak).toBe(0);
  });

  it("counts consecutive goal_reached=true entries as streak", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([
      { week_start: "2026-01-12", goal_reached: true },
      { week_start: "2026-01-05", goal_reached: true },
      { week_start: "2025-12-29", goal_reached: false },
    ]);
    const workouts: never[] = [];
    const { result } = renderHook(() => useWeeklyStreak(workouts, 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streak).toBe(2);
  });

  it("stops counting streak when a non-reached week is encountered", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([
      { week_start: "2026-01-12", goal_reached: false },
      { week_start: "2026-01-05", goal_reached: true },
    ]);
    const workouts: never[] = [];
    const { result } = renderHook(() => useWeeklyStreak(workouts, 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streak).toBe(0);
  });

  it("calls upsertWeeklyCompletion when weeklyGoalReached is true", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    // Stable like query data, so a re-render does not re-run the sync.
    const workouts: never[] = [];
    const { result } = renderHook(() => useWeeklyStreak(workouts, 3, 3, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(upsertWeeklyCompletion).toHaveBeenCalledWith(
      expect.any(String),
      3,
      3,
      true,
    );
  });

  it("counts last week's training days by local_date, so a day does not move when the user travels", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);

    const lastWeekStart = subWeeks(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      1,
    );
    const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });

    // Two training days last week. The Sunday one was logged abroad, so its
    // instant now renders as the Monday of this week: deriving the day from
    // date_completed drops it out of last week entirely.
    const workouts = [
      makeWorkout(lastWeekStart),
      makeTravelledWorkout(lastWeekEnd),
    ] as CompletedWorkout[];

    renderHook(() => useWeeklyStreak(workouts, 2, 0, false));
    await waitFor(() => expect(upsertWeeklyCompletion).toHaveBeenCalled());

    const [, , uniqueDays, goalReached] = (upsertWeeklyCompletion as jest.Mock)
      .mock.calls[0];
    expect(uniqueDays).toBe(2);
    expect(goalReached).toBe(true);
  });

  it("does not upsert current week when goal is not reached (upserts last week instead)", async () => {
    // Empty completions → last week entry is absent → it will be upserted once.
    // Current week upsert only happens when weeklyGoalReached = true, so it must NOT be called.
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    const workouts: never[] = [];
    const { result } = renderHook(() => useWeeklyStreak(workouts, 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Exactly one upsert: for the previous week with goal_reached=false
    expect(upsertWeeklyCompletion).toHaveBeenCalledTimes(1);
    const expectedLastWeekStart = format(
      subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1),
      "yyyy-MM-dd",
    );
    const weekStartArg = (upsertWeeklyCompletion as jest.Mock).mock.calls[0][0];
    expect(weekStartArg).toBe(expectedLastWeekStart);
    expect(upsertWeeklyCompletion).toHaveBeenCalledWith(
      expectedLastWeekStart,
      3,
      0,
      false,
    );
  });

  it("recounts last week when a backdated save lands in it after the week was recorded", async () => {
    const lastWeekStart = subWeeks(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      1,
    );
    const lastWeekStartStr = format(lastWeekStart, "yyyy-MM-dd");
    // Recorded on Monday with one day; a stale workout from last Friday was
    // saved afterwards.
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([
      {
        week_start: lastWeekStartStr,
        goal: 2,
        completed: 1,
        goal_reached: 0,
      },
    ]);
    const friday = new Date(lastWeekStart);
    friday.setDate(friday.getDate() + 4);
    const workouts = [
      makeWorkout(lastWeekStart),
      makeWorkout(friday),
    ] as CompletedWorkout[];

    // The current goal changed since; the recorded goal is kept.
    renderHook(() => useWeeklyStreak(workouts, 5, 0, false));
    await waitFor(() =>
      expect(upsertWeeklyCompletion).toHaveBeenCalledWith(
        lastWeekStartStr,
        2,
        2,
        true,
      ),
    );
  });

  it("leaves a recorded last week alone when its count has not changed", async () => {
    const lastWeekStart = subWeeks(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      1,
    );
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([
      {
        week_start: format(lastWeekStart, "yyyy-MM-dd"),
        goal: 2,
        completed: 1,
        goal_reached: 0,
      },
    ]);
    const workouts = [makeWorkout(lastWeekStart)] as CompletedWorkout[];

    renderHook(() => useWeeklyStreak(workouts, 2, 0, false));
    await waitFor(() => expect(getWeeklyCompletions).toHaveBeenCalledTimes(2));
    expect(upsertWeeklyCompletion).not.toHaveBeenCalled();
  });
});
