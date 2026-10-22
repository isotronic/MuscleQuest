// persistedStoreRehydration.test.ts
//
// A user can update the app in the middle of a workout. The payloads below are
// what the stores wrote to AsyncStorage under zustand v4 (captured from the
// v4 stores, not hand-built), so a zustand upgrade or a persist change that
// cannot read them back fails here instead of losing the session.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useActiveWorkoutStore } from "../activeWorkoutStore";
import { useWorkoutStore } from "../workoutStore";
import { useSocialStore } from "../socialStore";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

const ACTIVE_WORKOUT_V4 =
  '{"state":{"activeWorkout":{"planId":3,"workoutId":7,"name":"Push"},"workout":{"id":7,"name":"Push","exercises":[{"exercise_id":11,"name":"Bench Press","tracking_type":"weight","sets":[{"isWarmup":false,"repsMin":8,"repsMax":10,"restMinutes":2,"restSeconds":0},{"isWarmup":false,"repsMin":8,"repsMax":10,"restMinutes":2,"restSeconds":0}]},{"exercise_id":12,"name":"Row","tracking_type":"weight","sets":[{"isWarmup":false,"repsMin":10,"repsMax":12,"restMinutes":1,"restSeconds":30}]}]},"originalWorkout":null,"isQuickWorkout":false,"currentExerciseIndex":0,"currentSetIndices":{"0":1,"1":0},"completedSets":{"0":{"0":true}},"weightAndReps":{"0":{"0":{"weight":"60","reps":"8"}}},"setDurations":{},"sessionNote":"felt good","setNotes":{"0":{"0":"easy"}},"appendedExerciseIndices":[],"feedbackSubmittedUweIds":[],"feedbackQueue":[],"feedbackCatchUp":[],"recoveryCheckInShown":false,"suggestedWeightPrefills":{},"savedCompletedWorkoutId":null,"savedDurationTrimmed":false,"timerRunning":true,"startTime":"2026-10-22T09:00:00.000Z","timerExpiry":"2026-10-22T09:05:00.000Z","currentSetStartedAt":"2026-10-22T09:03:00.000Z","lastActivityAt":"2026-10-22T09:03:30.000Z"},"version":1}';

const WORKOUT_DRAFT_V4 =
  '{"state":{"drafts":{"new":{"workouts":[{"name":"Day A","exercises":[]}],"planImageUrl":"cover.jpg","planSchedule":{"1":0},"draftName":"Draft plan"}}},"version":1}';

const SOCIAL_V4 =
  '{"state":{"friends":[{"uid":"f1","displayName":"Sam","photoURL":null}],"privacySettings":{"shareWorkouts":true},"publishedPlanIds":["p1"],"publishedWorkoutIds":["w1","w2"],"pendingRevocation":null},"version":1}';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("rehydrating payloads written by zustand v4", () => {
  it("resumes the active workout on the same set with its logged values and timers", async () => {
    await AsyncStorage.setItem("active-workout-store", ACTIVE_WORKOUT_V4);
    await useActiveWorkoutStore.persist.rehydrate();
    const state = useActiveWorkoutStore.getState();

    expect(state.activeWorkout).toEqual({
      planId: 3,
      workoutId: 7,
      name: "Push",
    });
    expect(state.workout?.exercises.map((e) => e.exercise_id)).toEqual([
      11, 12,
    ]);
    expect(state.currentExerciseIndex).toBe(0);
    expect(state.currentSetIndices).toEqual({ 0: 1, 1: 0 });
    expect(state.completedSets).toEqual({ 0: { 0: true } });
    expect(state.weightAndReps).toEqual({
      0: { 0: { weight: "60", reps: "8" } },
    });
    expect(state.sessionNote).toBe("felt good");
    expect(state.setNotes).toEqual({ 0: { 0: "easy" } });
    expect(state.timerRunning).toBe(true);
    // Dates are stored as ISO strings and must come back as Dates.
    expect(state.startTime).toBeInstanceOf(Date);
    expect((state.startTime as Date).toISOString()).toBe(
      "2026-10-22T09:00:00.000Z",
    );
    expect(state.timerExpiry).toBeInstanceOf(Date);
    expect((state.timerExpiry as Date).toISOString()).toBe(
      "2026-10-22T09:05:00.000Z",
    );
    expect((state.currentSetStartedAt as Date).toISOString()).toBe(
      "2026-10-22T09:03:00.000Z",
    );
    expect((state.lastActivityAt as Date).toISOString()).toBe(
      "2026-10-22T09:03:30.000Z",
    );
  });

  it("restores the plan editor draft", async () => {
    await AsyncStorage.setItem("workout-draft-store", WORKOUT_DRAFT_V4);
    await useWorkoutStore.persist.rehydrate();

    expect(useWorkoutStore.getState().drafts).toEqual({
      new: {
        workouts: [{ name: "Day A", exercises: [] }],
        planImageUrl: "cover.jpg",
        planSchedule: { 1: 0 },
        draftName: "Draft plan",
      },
    });
  });

  it("restores the cached social state", async () => {
    await AsyncStorage.setItem("social-store", SOCIAL_V4);
    await useSocialStore.persist.rehydrate();
    const state = useSocialStore.getState();

    expect(state.friends).toEqual([
      { uid: "f1", displayName: "Sam", photoURL: null },
    ]);
    expect(state.privacySettings).toEqual({ shareWorkouts: true });
    expect(state.publishedPlanIds).toEqual(["p1"]);
    expect(state.publishedWorkoutIds).toEqual(["w1", "w2"]);
    expect(state.pendingRevocation).toBeNull();
  });
});
