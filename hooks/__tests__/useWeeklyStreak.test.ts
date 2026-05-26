import { renderHook, waitFor } from "@testing-library/react-native";
import { useWeeklyStreak } from "../useWeeklyStreak";
import { getWeeklyCompletions, upsertWeeklyCompletion } from "@/utils/database";
import { startOfWeek, subWeeks, format } from "date-fns";

jest.mock("@/utils/database", () => ({
  getWeeklyCompletions: jest.fn(),
  upsertWeeklyCompletion: jest.fn(),
}));

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
    const { result } = renderHook(() => useWeeklyStreak([], 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("returns streak = 0 when there are no completions", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    const { result } = renderHook(() => useWeeklyStreak([], 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streak).toBe(0);
  });

  it("counts consecutive goal_reached=true entries as streak", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([
      { week_start: "2026-01-12", goal_reached: true },
      { week_start: "2026-01-05", goal_reached: true },
      { week_start: "2025-12-29", goal_reached: false },
    ]);
    const { result } = renderHook(() => useWeeklyStreak([], 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streak).toBe(2);
  });

  it("stops counting streak when a non-reached week is encountered", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([
      { week_start: "2026-01-12", goal_reached: false },
      { week_start: "2026-01-05", goal_reached: true },
    ]);
    const { result } = renderHook(() => useWeeklyStreak([], 3, 0, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streak).toBe(0);
  });

  it("calls upsertWeeklyCompletion when weeklyGoalReached is true", async () => {
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    renderHook(() => useWeeklyStreak([], 3, 3, true));
    await waitFor(() =>
      expect(upsertWeeklyCompletion).toHaveBeenCalledWith(
        expect.any(String),
        3,
        3,
        true,
      ),
    );
  });

  it("does not upsert current week when goal is not reached (upserts last week instead)", async () => {
    // Empty completions → last week entry is absent → it will be upserted once.
    // Current week upsert only happens when weeklyGoalReached = true, so it must NOT be called.
    (getWeeklyCompletions as jest.Mock).mockResolvedValue([]);
    renderHook(() => useWeeklyStreak([], 3, 0, false));
    await waitFor(() => expect(getWeeklyCompletions).toHaveBeenCalled());
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
});
