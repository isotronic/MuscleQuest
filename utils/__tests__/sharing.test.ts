import {
  bulkPublishAllPlans,
  bulkPublishAllStandaloneWorkouts,
  bulkPublishAllCustomExercises,
} from "../sharing";
import * as db from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  fetchAllPlanIds: jest.fn(),
  fetchAllStandaloneWorkoutIds: jest.fn(),
  fetchAllCustomExercisesForSharing: jest.fn(),
  fetchFullPlanForSharing: jest.fn(),
  fetchStandaloneWorkoutForSharing: jest.fn(),
}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest
  .fn()
  .mockResolvedValue({ exists: () => false, data: () => ({}) });
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  doc: jest.fn((_db, ...segments) => segments.join("/")),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  serverTimestamp: jest.fn().mockReturnValue("__serverTimestamp__"),
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  writeBatch: jest.fn(() => ({ set: jest.fn(), commit: jest.fn() })),
  limit: jest.fn(),
  query: jest.fn(),
  Timestamp: { fromDate: jest.fn((d) => d) },
}));

const minimalPlanData = {
  plan: { name: "Test Plan", image_url: null },
  workouts: [],
};

const minimalWorkoutData = {
  workout_name: "Test Workout",
  image_url: null,
  exercises: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (db.fetchFullPlanForSharing as jest.Mock).mockResolvedValue(minimalPlanData);
  (db.fetchStandaloneWorkoutForSharing as jest.Mock).mockResolvedValue(
    minimalWorkoutData,
  );
});

describe("bulkPublishAllPlans", () => {
  it("calls publishPlan for each returned plan ID", async () => {
    (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([1, 2, 3]);

    await bulkPublishAllPlans("uid123");

    expect(db.fetchAllPlanIds).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledTimes(3);
  });

  it("does nothing when there are no plans", async () => {
    (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([]);

    await bulkPublishAllPlans("uid123");

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("reports fetch errors to Bugsnag and does not throw", async () => {
    const err = new Error("db fail");
    (db.fetchAllPlanIds as jest.Mock).mockRejectedValue(err);

    await expect(bulkPublishAllPlans("uid123")).resolves.toBeUndefined();
    expect(Bugsnag.notify).toHaveBeenCalledWith(err);
  });
});

describe("bulkPublishAllStandaloneWorkouts", () => {
  it("calls publishStandaloneWorkout for each returned workout ID", async () => {
    (db.fetchAllStandaloneWorkoutIds as jest.Mock).mockResolvedValue([10, 20]);

    await bulkPublishAllStandaloneWorkouts("uid123");

    expect(db.fetchAllStandaloneWorkoutIds).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it("does nothing when there are no workouts", async () => {
    (db.fetchAllStandaloneWorkoutIds as jest.Mock).mockResolvedValue([]);
    await bulkPublishAllStandaloneWorkouts("uid123");
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("reports fetch errors to Bugsnag and does not throw", async () => {
    const err = new Error("db fail");
    (db.fetchAllStandaloneWorkoutIds as jest.Mock).mockRejectedValue(err);

    await expect(
      bulkPublishAllStandaloneWorkouts("uid123"),
    ).resolves.toBeUndefined();
    expect(Bugsnag.notify).toHaveBeenCalledWith(err);
  });
});

describe("bulkPublishAllCustomExercises", () => {
  it("calls pushCustomExercise for each returned exercise", async () => {
    const exercises = [
      { exercise_id: 1, name: "Ex A", app_exercise_id: null },
      { exercise_id: 2, name: "Ex B", app_exercise_id: null },
    ];
    (db.fetchAllCustomExercisesForSharing as jest.Mock).mockResolvedValue(
      exercises,
    );

    await bulkPublishAllCustomExercises("uid123");

    expect(db.fetchAllCustomExercisesForSharing).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it("does nothing when there are no custom exercises", async () => {
    (db.fetchAllCustomExercisesForSharing as jest.Mock).mockResolvedValue([]);
    await bulkPublishAllCustomExercises("uid123");
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("reports fetch errors to Bugsnag and does not throw", async () => {
    const err = new Error("db fail");
    (db.fetchAllCustomExercisesForSharing as jest.Mock).mockRejectedValue(err);

    await expect(
      bulkPublishAllCustomExercises("uid123"),
    ).resolves.toBeUndefined();
    expect(Bugsnag.notify).toHaveBeenCalledWith(err);
  });
});
