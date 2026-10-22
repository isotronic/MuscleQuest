import { renderHook } from "@testing-library/react-native";
import { useSessionPRs } from "../useSessionPRs";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { usePriorBestsQuery } from "@/hooks/useWorkoutSummariesQuery";
import { computeSessionPRs } from "@/utils/sessionPRs";

jest.mock("@/hooks/useSettingsQuery", () => ({ useSettingsQuery: jest.fn() }));
jest.mock("@/hooks/useDeloadWeekQuery", () => ({
  useDeloadWeekQuery: jest.fn(),
}));
jest.mock("@/hooks/useWorkoutSummariesQuery", () => ({
  usePriorBestsQuery: jest.fn(),
}));
jest.mock("@/utils/sessionPRs", () => ({ computeSessionPRs: jest.fn() }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

const exercise = (exercise_id: number) => ({
  exercise_id,
  name: `Exercise ${exercise_id}`,
  sets: [],
});

const priorBests = [{ exercise_id: 100 }];
const livePRs = { 100: { weight: true } };

describe("useSessionPRs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActiveWorkoutStore.setState({
      workout: {
        name: "Push",
        exercises: [exercise(300), exercise(100), exercise(300)],
      } as any,
      activeWorkout: { planId: 3 } as any,
      completedSets: { 0: { 0: true } },
      weightAndReps: {},
    });
    (useSettingsQuery as jest.Mock).mockReturnValue({
      data: { weightUnit: "lbs", distanceUnit: "m", bodyWeight: "176" },
    });
    (useDeloadWeekQuery as jest.Mock).mockReturnValue({
      isCurrentWeekDeload: false,
    });
    (usePriorBestsQuery as jest.Mock).mockReturnValue({ data: priorBests });
    (computeSessionPRs as jest.Mock).mockReturnValue(livePRs);
  });

  it("counts nothing in a deload week", () => {
    (useDeloadWeekQuery as jest.Mock).mockReturnValue({
      isCurrentWeekDeload: true,
    });

    const { result } = renderHook(() => useSessionPRs());

    expect(result.current.prs).toEqual({});
    expect(result.current.prsWithSetCompleted(0, 1)).toEqual({});
    expect(computeSessionPRs).not.toHaveBeenCalled();
  });

  it("counts nothing before the prior bests load", () => {
    (usePriorBestsQuery as jest.Mock).mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useSessionPRs());

    expect(result.current.prs).toEqual({});
    expect(computeSessionPRs).not.toHaveBeenCalled();
  });

  it("asks for each exercise's bests once and compares in kg", () => {
    const { result } = renderHook(() => useSessionPRs());

    expect(usePriorBestsQuery).toHaveBeenCalledWith([100, 300]);
    expect(useDeloadWeekQuery).toHaveBeenCalledWith(3);
    expect(result.current.prs).toBe(livePRs);
    const input = (computeSessionPRs as jest.Mock).mock.calls[0][0];
    expect(input.priorBests).toBe(priorBests);
    expect(input.weightUnit).toBe("lbs");
    expect(input.bodyWeightKg).toBeCloseTo(79.83, 2);
  });

  it("checks a set as if it were completed without changing the store", () => {
    const { result } = renderHook(() => useSessionPRs());
    (computeSessionPRs as jest.Mock).mockClear();

    result.current.prsWithSetCompleted(0, 1);

    const input = (computeSessionPRs as jest.Mock).mock.calls[0][0];
    expect(input.completedSets).toEqual({ 0: { 0: true, 1: true } });
    expect(useActiveWorkoutStore.getState().completedSets).toEqual({
      0: { 0: true },
    });
  });
});
