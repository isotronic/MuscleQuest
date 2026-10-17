import { renderHook, act } from "@testing-library/react-native";
import { Vibration } from "react-native";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import {
  PR_VIBRATION,
  restAfterSetInPlace,
  useCompleteSet,
} from "../useCompleteSet";
import { confirmImplausibleWeight } from "@/utils/confirmImplausibleWeight";
import {
  cancelRestNotifications,
  startRestNotification,
} from "@/utils/restNotification";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce((acc, part, i) => acc + part + (i < v.length ? v[i] : ""), ""),
  plural: () => "",
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { weightUnit: "kg" } }),
}));
const mockProgression = { enabled: false };
jest.mock("@/hooks/useProgressionSettingsQuery", () => ({
  useProgressionSettingsQuery: () => mockProgression,
}));
jest.mock("@/hooks/useDeloadWeekQuery", () => ({
  useDeloadWeekQuery: () => ({ isCurrentWeekDeload: false }),
}));
const mockPRs: { current: Record<number, number[]> } = { current: {} };
jest.mock("@/hooks/useSessionPRs", () => ({
  useSessionPRs: () => ({
    prs: {},
    prsWithSetCompleted: () => mockPRs.current,
  }),
}));
jest.mock("@/utils/confirmImplausibleWeight", () => ({
  confirmImplausibleWeight: jest.fn(),
}));
jest.mock("@/utils/restNotification", () => ({
  cancelRestNotifications: jest.fn(() => Promise.resolve()),
  startRestNotification: jest.fn(() =>
    Promise.resolve({ showPermissionHint: false, showExactAlarmHint: false }),
  ),
}));

const set = (rest = 90) => ({
  isWarmup: false,
  repsMin: 8,
  repsMax: 12,
  restMinutes: Math.floor(rest / 60),
  restSeconds: rest % 60,
});
const exercise = (id: number, extra: object = {}) => ({
  id: id * 10,
  exercise_id: id,
  name: `Exercise ${id}`,
  tracking_type: "weight",
  sets: [set(), set()],
  ...extra,
});

const start = (exercises: unknown[]) =>
  useActiveWorkoutStore
    .getState()
    .setWorkout({ id: 1, name: "Push", exercises } as any, 1, 1, "Push");
const store = () => useActiveWorkoutStore.getState();

describe("useCompleteSet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
    mockPRs.current = {};
    mockProgression.enabled = false;
    start([exercise(1), exercise(2)]);
  });

  it("prepareSet writes the shown values without marking the set done", () => {
    store().updateWeightAndReps(0, 0, "60", "8");
    const { result } = renderHook(() => useCompleteSet());
    const onPrepared = jest.fn();
    act(() => result.current.prepareSet(0, 0, onPrepared));
    expect(onPrepared).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseIndex: 0,
        setIndex: 0,
        weight: "60",
        reps: "8",
        isPR: false,
      }),
    );
    expect(store().weightAndReps[0][0]).toMatchObject({
      weight: "60",
      reps: "8",
    });
    expect(store().completedSets[0]?.[0]).toBeUndefined();
  });

  it("completes a set in place, and starts its rest", () => {
    store().updateWeightAndReps(0, 0, "60", "8");
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 0));
    expect(store().completedSets[0]).toEqual({ 0: true });
    expect(store().currentExerciseIndex).toBe(0);
    expect(store().timerRunning).toBe(true);
    expect(startRestNotification).toHaveBeenCalledWith(
      90,
      expect.any(String),
      expect.any(String),
    );
    expect(store().setDurations?.[0]?.[0] ?? null).toBeNull();
  });

  it("flags a PR the same way for both paths", () => {
    mockPRs.current = { 0: [0] };
    store().updateWeightAndReps(0, 0, "200", "8");
    const { result } = renderHook(() => useCompleteSet());
    const onPrepared = jest.fn();
    act(() => result.current.prepareSet(0, 0, onPrepared));
    expect(onPrepared.mock.calls[0][0].isPR).toBe(true);
    expect(Vibration.vibrate).toHaveBeenCalledWith(PR_VIBRATION);
    const onDone = jest.fn();
    act(() => result.current.completeSetInPlace(0, 0, onDone));
    expect(onDone.mock.calls[0][0].isPR).toBe(true);
  });

  it("ends a running rest before completing", () => {
    store().startTimer(new Date(Date.now() + 60_000));
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.prepareSet(0, 0, jest.fn()));
    expect(store().timerRunning).toBe(false);
    expect(cancelRestNotifications).toHaveBeenCalled();
  });

  it("asks about an implausible weight and completes with the correction", () => {
    store().updateWeightAndReps(0, 0, "600", "8");
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 0));
    expect(confirmImplausibleWeight).toHaveBeenCalled();
    expect(store().completedSets[0]?.[0]).toBeUndefined();
    const { onUse } = (confirmImplausibleWeight as jest.Mock).mock.calls[0][0];
    act(() => onUse(60));
    expect(store().weightAndReps[0][0]).toMatchObject({ weight: "60" });
    expect(store().completedSets[0]).toEqual({ 0: true });
  });

  it("records the duration only for the set being timed", () => {
    const startedAt = new Date(Date.now() - 45_000);
    store().setCurrentSetStartedAt(startedAt);
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 0));
    expect(store().setDurations[0][0]).toBeGreaterThanOrEqual(45);
    expect(store().currentSetStartedAt).toBeNull();
  });

  it("starts timing the next set at once when there is no rest", () => {
    start([
      exercise(1, { supersetGroupId: "s" }),
      exercise(2, { supersetGroupId: "s" }),
    ]);
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 0));
    // The partner's half of the round comes next, with no rest between.
    expect(store().timerRunning).toBe(false);
    expect(store().currentSetStartedAt).not.toBeNull();
  });

  it("leaves timing to the rest when one starts", () => {
    store().setCurrentSetStartedAt(new Date(Date.now() - 20 * 60_000));
    const { result } = renderHook(() => useCompleteSet());
    // Not the set being timed, so the old start is stale.
    act(() => result.current.completeSetInPlace(1, 1));
    expect(store().timerRunning).toBe(true);
    expect(store().currentSetStartedAt).toBeNull();
  });

  it("times nothing once every set is done", () => {
    start([{ ...exercise(1), sets: [set(0)] }]);
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 0));
    expect(store().currentSetStartedAt).toBeNull();
  });

  it("builds feedback from a corrected weight", () => {
    mockProgression.enabled = true;
    store().updateWeightAndReps(0, 0, "60", "10");
    store().completeSetAt(0, 0);
    store().updateWeightAndReps(0, 1, "600", "10");
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 1));
    const { onUse } = (confirmImplausibleWeight as jest.Mock).mock.calls[0][0];
    act(() => onUse(60));
    expect(store().feedbackQueue).toEqual([
      expect.objectContaining({
        exerciseContext: expect.objectContaining({ recentWorkingWeight: 60 }),
      }),
    ]);
  });

  it("does not ask again about a weight kept on another screen", () => {
    store().updateWeightAndReps(0, 0, "600", "8");
    store().updateWeightAndReps(0, 1, "600", "8");
    const first = renderHook(() => useCompleteSet());
    act(() => first.result.current.completeSetInPlace(0, 0));
    const { onKeep } = (confirmImplausibleWeight as jest.Mock).mock.calls[0][0];
    act(() => onKeep());
    const second = renderHook(() => useCompleteSet());
    act(() => second.result.current.completeSetInPlace(0, 1));
    expect(confirmImplausibleWeight).toHaveBeenCalledTimes(1);
    expect(store().completedSets[0]).toEqual({ 0: true, 1: true });
  });

  it("queues feedback once an exercise's sets are all done", () => {
    mockProgression.enabled = true;
    store().updateWeightAndReps(0, 0, "60", "10");
    store().updateWeightAndReps(0, 1, "60", "10");
    const { result } = renderHook(() => useCompleteSet());
    act(() => result.current.completeSetInPlace(0, 0));
    expect(store().feedbackQueue).toEqual([]);
    act(() => result.current.completeSetInPlace(0, 1));
    expect(store().feedbackQueue).toEqual([
      expect.objectContaining({ userWorkoutExerciseId: 10 }),
    ]);
  });
});

describe("restAfterSetInPlace", () => {
  const ex = (sets: number, superset?: string) =>
    ({
      ...exercise(1, superset ? { supersetGroupId: superset } : {}),
      sets: Array.from({ length: sets }, () => set(75)),
    }) as any;

  it("rests after a set when work is left", () => {
    expect(restAfterSetInPlace([ex(2)], { 0: { 0: true } }, 0, 0)).toBe(75);
  });

  it("does not rest after the last set of the workout", () => {
    expect(
      restAfterSetInPlace([ex(2)], { 0: { 0: true, 1: true } }, 0, 1),
    ).toBe(0);
  });

  it("waits for the superset partner's half of the round", () => {
    const exercises = [ex(2, "s"), ex(2, "s")];
    expect(restAfterSetInPlace(exercises, { 0: { 0: true } }, 0, 0)).toBe(0);
    expect(
      restAfterSetInPlace(exercises, { 0: { 0: true }, 1: { 0: true } }, 1, 0),
    ).toBe(75);
  });

  it("rests when the partner has no set in that round", () => {
    const exercises = [ex(3, "s"), ex(2, "s")];
    expect(
      restAfterSetInPlace(
        exercises,
        { 0: { 0: true, 2: true }, 1: { 0: true, 1: true } },
        0,
        2,
      ),
    ).toBe(75);
  });
});
