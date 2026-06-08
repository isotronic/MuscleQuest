import { useSaveCompletedWorkoutMutation } from "../useSaveCompletedWorkoutMutation";
import { saveCompletedWorkout } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(null),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
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
              weight: expect.closeTo(100 * 0.45359237, 4),
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
              distance: expect.closeTo(100 * 0.3048, 4),
            }),
          ]),
        }),
      ]),
    );
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
});
