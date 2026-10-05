import { useSaveCompletedWorkoutMutation } from "../useSaveCompletedWorkoutMutation";
import { saveCompletedWorkout } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KG_PER_LB, M_PER_FT, roundCanonical } from "@/utils/units";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(null),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return {
    AuthContext: React.createContext(null),
    AuthLoadingContext: React.createContext(false),
    waitForAuthUser: jest.fn().mockResolvedValue(null),
  };
});
jest.mock("@react-native-firebase/firestore", () => {
  const mockFirestore: any = jest.fn(() => ({ collection: jest.fn() }));
  mockFirestore.FieldValue = { serverTimestamp: jest.fn() };
  mockFirestore.Timestamp = {
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  };
  return mockFirestore;
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({
    privacySettings: null,
    publishedPlanIds: null,
    publishedWorkoutIds: null,
  })),
}));
jest.mock("@/utils/sharing", () => ({
  pushCompletedWorkout: jest.fn(() => Promise.resolve()),
  pushStrengthPRs: jest.fn(() => Promise.resolve()),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@/utils/database", () => ({
  saveCompletedWorkout: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

const makeWorkoutData = (overrides: Record<string, any> = {}) => ({
  planId: 1,
  workoutId: 2,
  duration: 3600,
  totalSetsCompleted: 3,
  exercises: [
    {
      exercise_id: 100,
      sets: [
        { set_number: 1, weight: 100, reps: 8, time: null, distance: null },
      ],
    },
  ],
  ...overrides,
});

describe("useSaveCompletedWorkoutMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    (saveCompletedWorkout as jest.Mock).mockResolvedValue(1);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    (saveCompletedWorkout as jest.Mock).mockResolvedValue(1);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls saveCompletedWorkout without converting kg", async () => {
    useSaveCompletedWorkoutMutation("kg", "m");

    await capturedArgs.mutationFn(makeWorkoutData());

    expect(saveCompletedWorkout).toHaveBeenCalledWith(
      1, // planId
      2, // workoutId
      3600, // duration
      3, // totalSetsCompleted
      false, // isDeload
      expect.arrayContaining([
        expect.objectContaining({
          sets: expect.arrayContaining([
            expect.objectContaining({ weight: 100 }), // unchanged
          ]),
        }),
      ]),
    );
  });

  it("mutationFn converts weight from lbs to kg before saving", async () => {
    useSaveCompletedWorkoutMutation("lbs", "m");

    await capturedArgs.mutationFn(makeWorkoutData());

    expect(saveCompletedWorkout).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(), // isDeload
      expect.arrayContaining([
        expect.objectContaining({
          sets: expect.arrayContaining([
            expect.objectContaining({
              // 45.359237, rounded for storage.
              weight: roundCanonical(100 * KG_PER_LB),
            }),
          ]),
        }),
      ]),
    );
  });

  it("mutationFn converts distance from ft to m before saving", async () => {
    const data = makeWorkoutData({
      exercises: [
        {
          exercise_id: 100,
          sets: [
            {
              set_number: 1,
              weight: null,
              reps: null,
              time: null,
              distance: 100,
            },
          ],
        },
      ],
    });

    useSaveCompletedWorkoutMutation("kg", "ft");

    await capturedArgs.mutationFn(data);

    expect(saveCompletedWorkout).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(), // isDeload
      expect.arrayContaining([
        expect.objectContaining({
          sets: expect.arrayContaining([
            expect.objectContaining({
              distance: expect.closeTo(100 * M_PER_FT, 4),
            }),
          ]),
        }),
      ]),
    );
  });

  it("stores the same rounded kg value every time 225 lbs is saved", async () => {
    const data = makeWorkoutData({
      exercises: [
        {
          exercise_id: 100,
          sets: [
            { set_number: 1, weight: 225, reps: 5, time: null, distance: 10 },
          ],
        },
      ],
    });

    useSaveCompletedWorkoutMutation("lbs", "ft");
    await capturedArgs.mutationFn(data);
    await capturedArgs.mutationFn(data);

    const stored = (saveCompletedWorkout as jest.Mock).mock.calls.map(
      (call) => call[5][0].sets[0],
    );
    // Unrounded, 225 lbs was stored as 102.05820832500001.
    expect(stored[0].weight).toBe(102.058);
    expect(stored[1].weight).toBe(stored[0].weight);
    expect(stored[0].distance).toBe(3.048);
  });

  it("preserves null weight as null", async () => {
    const data = makeWorkoutData({
      exercises: [
        {
          exercise_id: 100,
          sets: [
            {
              set_number: 1,
              weight: null,
              reps: 10,
              time: null,
              distance: null,
            },
          ],
        },
      ],
    });

    useSaveCompletedWorkoutMutation("kg", "m");

    await capturedArgs.mutationFn(data);

    expect(saveCompletedWorkout).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(), // isDeload
      expect.arrayContaining([
        expect.objectContaining({
          sets: expect.arrayContaining([
            expect.objectContaining({ weight: null }),
          ]),
        }),
      ]),
    );
  });

  it("onSuccess invalidates completedWorkouts and trackedExercises", () => {
    useSaveCompletedWorkoutMutation("kg", "m");

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkouts"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["trackedExercises"],
    });
  });

  it("onSuccess invalidates globalExerciseHistoryForSession", () => {
    useSaveCompletedWorkoutMutation("lbs", "ft");

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["globalExerciseHistoryForSession", "lbs", "ft"],
    });
  });

  it("onSuccess invalidates exerciseDetail so the exercise screen refetches", () => {
    useSaveCompletedWorkoutMutation("kg", "m");

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["exerciseDetail"],
    });
  });

  describe("sharing a workout saved before the session is restored", () => {
    const { useSocialStore } = jest.requireMock("@/store/socialStore");
    const { pushCompletedWorkout } = jest.requireMock("@/utils/sharing");
    const { waitForAuthUser } = jest.requireMock("@/context/AuthProvider");

    beforeEach(() => {
      useSocialStore.mockReturnValue({
        privacySettings: { shareCompletedWorkouts: true },
      });
      pushCompletedWorkout.mockClear();
    });

    afterEach(() => {
      waitForAuthUser.mockResolvedValue(null);
    });

    it("pushes once the restored user is known", async () => {
      waitForAuthUser.mockResolvedValue({ uid: "late-uid" });
      useSaveCompletedWorkoutMutation("kg", "m");

      capturedArgs.onSuccess(42, makeWorkoutData());
      await Promise.resolve();
      await Promise.resolve();

      expect(pushCompletedWorkout).toHaveBeenCalledWith("late-uid", 42);
    });

    it("pushes nothing when the user is signed out", async () => {
      useSaveCompletedWorkoutMutation("kg", "m");

      capturedArgs.onSuccess(42, makeWorkoutData());
      await Promise.resolve();
      await Promise.resolve();

      expect(pushCompletedWorkout).not.toHaveBeenCalled();
    });
  });
});
