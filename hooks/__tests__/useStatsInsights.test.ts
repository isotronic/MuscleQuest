import { renderHook } from "@testing-library/react-native";
import { useStatsInsights } from "../useStatsInsights";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeWorkout = (
  exerciseId: number,
  setCount: number,
  warmupCount = 0,
): any => ({
  id: 1,
  date_completed: "2026-01-01",
  exercises: [
    {
      exercise_id: exerciseId,
      sets: [
        ...Array.from({ length: setCount }, () => ({ is_warmup: false })),
        ...Array.from({ length: warmupCount }, () => ({ is_warmup: true })),
      ],
    },
  ],
});

const makeTrackedExercise = (
  name: string,
  trackingType: string,
  progressionMetrics: number[],
): any => ({
  name,
  tracking_type: trackingType,
  completed_sets: progressionMetrics.map((m) => ({ progressionMetric: m })),
});

const makeExercise = (id: number, bodyPart: string): any => ({
  exercise_id: id,
  body_part: bodyPart,
});

// ---------------------------------------------------------------------------
// workoutsPerWeek
// ---------------------------------------------------------------------------

describe("workoutsPerWeek", () => {
  it("returns null when completedWorkouts is undefined", () => {
    const { result } = renderHook(() =>
      useStatsInsights(undefined, [], [], 7, "kg"),
    );
    expect(result.current.workoutsPerWeek).toBeNull();
  });

  it("returns null when completedWorkouts is empty", () => {
    const { result } = renderHook(() => useStatsInsights([], [], [], 7, "kg"));
    expect(result.current.workoutsPerWeek).toBeNull();
  });

  it("returns null when timeRangeDays is 0", () => {
    const { result } = renderHook(() =>
      useStatsInsights([makeWorkout(1, 3)], [], [], 0, "kg"),
    );
    expect(result.current.workoutsPerWeek).toBeNull();
  });

  it("calculates workouts per week correctly", () => {
    const workouts = Array.from({ length: 7 }, (_, i) => ({
      ...makeWorkout(1, 3),
      date_completed: `2026-01-0${i + 1}`,
    }));
    const { result } = renderHook(() =>
      useStatsInsights(workouts, [], [], 7, "kg"),
    );
    expect(result.current.workoutsPerWeek).toBeCloseTo(7);
  });
});

// ---------------------------------------------------------------------------
// biggestGain (tracking type branches)
// ---------------------------------------------------------------------------

describe("biggestGain", () => {
  it("returns null when trackedExercises is undefined", () => {
    const { result } = renderHook(() =>
      useStatsInsights([], undefined, [], 7, "kg"),
    );
    expect(result.current.biggestGainLabel).toBeNull();
    expect(result.current.biggestGainValue).toBeNull();
  });

  it("returns null when exercise has fewer than 2 sets", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Bench", "weight", [100])],
        [],
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainLabel).toBeNull();
  });

  it("formats weight gain in kg", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Bench Press", "weight", [120, 100])],
        [],
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainLabel).toBe("Bench Press");
    expect(result.current.biggestGainValue).toBe("+20.0 kg");
  });

  it("converts weight gain to lbs", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Bench Press", "weight", [120, 100])],
        [],
        7,
        "lbs",
      ),
    );
    const numStr = result.current.biggestGainValue!.replace(/[^0-9.]/g, "");
    expect(parseFloat(numStr)).toBeCloseTo(20 * 2.2046226, 1);
  });

  it("formats reps gain", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Pull-ups", "reps", [20, 15])],
        [],
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainValue).toBe("+5 reps");
  });

  it("formats time gain", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Plank", "time", [120, 90])],
        [],
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainValue).toBe("+30s");
  });

  it("formats distance gain with default distance unit", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Run", "distance", [5.5, 4.0])],
        [],
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainValue).toBe("+1.5 m");
  });

  it("returns null label/value when gain is negative", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        [],
        [makeTrackedExercise("Bench Press", "weight", [90, 100])],
        [],
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainLabel).toBeNull();
    expect(result.current.biggestGainValue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// topBodyPart — includes mapBodyPart normalization
// ---------------------------------------------------------------------------

describe("topBodyPart", () => {
  it("returns null when completedWorkouts is empty", () => {
    const { result } = renderHook(() => useStatsInsights([], [], [], 7, "kg"));
    expect(result.current.topBodyPart).toBeNull();
  });

  it("returns the body part with the most sets", () => {
    const workouts = [
      makeWorkout(1, 3), // chest — 3 sets
      makeWorkout(2, 1), // back — 1 set
    ];
    const exercises = [makeExercise(1, "chest"), makeExercise(2, "back")];
    const { result } = renderHook(() =>
      useStatsInsights(workouts, [], exercises, 7, "kg"),
    );
    expect(result.current.topBodyPart).toBe("chest");
  });

  it("normalizes 'upper arms' and 'lower arms' to 'arms'", () => {
    const workouts = [makeWorkout(1, 2), makeWorkout(2, 3)];
    const exercises = [
      makeExercise(1, "upper arms"),
      makeExercise(2, "lower arms"),
    ];
    const { result } = renderHook(() =>
      useStatsInsights(workouts, [], exercises, 7, "kg"),
    );
    expect(result.current.topBodyPart).toBe("arms");
  });

  it("normalizes 'upper legs' and 'lower legs' to 'legs'", () => {
    const workouts = [makeWorkout(1, 2), makeWorkout(2, 3)];
    const exercises = [
      makeExercise(1, "upper legs"),
      makeExercise(2, "lower legs"),
    ];
    const { result } = renderHook(() =>
      useStatsInsights(workouts, [], exercises, 7, "kg"),
    );
    expect(result.current.topBodyPart).toBe("legs");
  });

  it("excludes warmup sets when excludeWarmup is true", () => {
    // chest has 1 work + 3 warmup sets; back has 2 work sets
    const workouts = [makeWorkout(1, 1, 3), makeWorkout(2, 2)];
    const exercises = [makeExercise(1, "chest"), makeExercise(2, "back")];
    const { result } = renderHook(() =>
      useStatsInsights(workouts, [], exercises, 7, "kg", "m", true),
    );
    // chest = 1 work set, back = 2 work sets → back wins
    expect(result.current.topBodyPart).toBe("back");
  });
});
