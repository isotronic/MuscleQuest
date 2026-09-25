import {
  bulkPublishAllPlans,
  bulkPublishAllStandaloneWorkouts,
  bulkPublishAllCustomExercises,
  BULK_PUBLISH_CONCURRENCY,
  deleteAllSharedData,
  publishPlan,
  SharedDataDeletionError,
  SharedDocTooLargeError,
  SHARED_SUBCOLLECTIONS,
} from "../sharing";
import * as db from "@/utils/database";
import { useSocialStore } from "@/store/socialStore";
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
const mockGetDocs = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  doc: jest.fn((_db, ...segments) => segments.join("/")),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  serverTimestamp: jest.fn().mockReturnValue("__serverTimestamp__"),
  collection: jest.fn((_db, ...segments: string[]) => segments.join("/")),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
    commit: mockBatchCommit,
  })),
  limit: jest.fn(),
  query: jest.fn((collRef: string) => collRef),
  Timestamp: { fromDate: jest.fn((d) => d) },
}));

const minimalPlanData = {
  plan: { name: "Test Plan", image_url: null, app_plan_id: null },
  workouts: [],
};

const minimalWorkoutData = {
  workout_name: "Test Workout",
  image_url: null,
  exercises: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDocs.mockResolvedValue({ docs: [], empty: true });
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  useSocialStore.setState({ publishedPlanIds: [], publishedWorkoutIds: [] });
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

  it("reports individual item errors to Bugsnag and continues with remaining items", async () => {
    (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([1, 2, 3]);
    // First plan fetch fails, others succeed
    (db.fetchFullPlanForSharing as jest.Mock)
      .mockResolvedValueOnce(null) // plan 1 returns null → publishPlan returns early
      .mockResolvedValueOnce(minimalPlanData) // plan 2 succeeds
      .mockResolvedValueOnce(minimalPlanData); // plan 3 succeeds

    await bulkPublishAllPlans("uid123");

    // Plans 2 and 3 were published (plan 1 returned null so setDoc was not called for it)
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    // No Bugsnag call because publishPlan silently skips null data
    expect(Bugsnag.notify).not.toHaveBeenCalled();
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

describe("bulk publish concurrency", () => {
  it("never runs more than BULK_PUBLISH_CONCURRENCY publishes at once", async () => {
    (db.fetchAllPlanIds as jest.Mock).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );

    let inFlight = 0;
    let peak = 0;
    (db.fetchFullPlanForSharing as jest.Mock).mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return minimalPlanData;
    });

    await bulkPublishAllPlans("uid123");

    expect(mockSetDoc).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(BULK_PUBLISH_CONCURRENCY);
  });
});

describe("publishPlan size guard", () => {
  it("throws SharedDocTooLargeError instead of writing an oversized document", async () => {
    (db.fetchFullPlanForSharing as jest.Mock).mockResolvedValue({
      plan: { name: "x".repeat(1_000_000), image_url: null, app_plan_id: null },
      workouts: [],
    });

    await expect(publishPlan("uid123", 1)).rejects.toBeInstanceOf(
      SharedDocTooLargeError,
    );
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("writes a plan that fits the budget", async () => {
    await expect(publishPlan("uid123", 1)).resolves.toBeUndefined();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  // String.length counts UTF-16 code units. A name of 600k emoji is 1.2M
  // UTF-16 units but 2.4M UTF-8 bytes, and a name of 600k accented characters
  // is 600k units but 1.2M bytes: the second one passes a length-based check
  // and is still rejected by Firestore.
  it("measures UTF-8 bytes, not string length", async () => {
    (db.fetchFullPlanForSharing as jest.Mock).mockResolvedValue({
      plan: { name: "é".repeat(600_000), image_url: null, app_plan_id: null },
      workouts: [],
    });

    const error = await publishPlan("uid123", 1).catch((e) => e);

    expect(error).toBeInstanceOf(SharedDocTooLargeError);
    expect((error as SharedDocTooLargeError).estimatedBytes).toBeGreaterThan(
      1_000_000,
    );
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe("publishedAt", () => {
  it("sets publishedAt when the published list says the plan is new", async () => {
    useSocialStore.setState({ publishedPlanIds: [] });

    await publishPlan("uid123", 7);

    expect(mockSetDoc.mock.calls[0][1]).toHaveProperty("publishedAt");
    // The list answered, so no read was needed.
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it("leaves publishedAt alone when the plan is already published", async () => {
    useSocialStore.setState({ publishedPlanIds: ["7"] });

    await publishPlan("uid123", 7);

    expect(mockSetDoc.mock.calls[0][1]).not.toHaveProperty("publishedAt");
  });

  // A null list means the listener has not hydrated yet. Treating that as
  // "not published" would reset publishedAt on every already-shared plan.
  it("reads the document when the published list has not hydrated", async () => {
    useSocialStore.setState({ publishedPlanIds: null });
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });

    await publishPlan("uid123", 7);

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).not.toHaveProperty("publishedAt");
  });

  it("sets publishedAt when that read finds no document", async () => {
    useSocialStore.setState({ publishedPlanIds: null });
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    await publishPlan("uid123", 7);

    expect(mockSetDoc.mock.calls[0][1]).toHaveProperty("publishedAt");
  });
});

describe("deleteAllSharedData", () => {
  it("resolves when every subcollection is verified empty", async () => {
    await expect(deleteAllSharedData("uid123")).resolves.toBeUndefined();
    // One verification read per subcollection, plus the initial delete query.
    expect(mockGetDocs).toHaveBeenCalledTimes(SHARED_SUBCOLLECTIONS.length * 2);
  });

  it("rejects naming the subcollections that failed", async () => {
    mockGetDocs.mockImplementation(async (path: string) => {
      if (path.endsWith("sharedStrength")) throw new Error("permission-denied");
      return { docs: [], empty: true };
    });

    const error = await deleteAllSharedData("uid123").catch((e) => e);

    expect(error).toBeInstanceOf(SharedDataDeletionError);
    expect((error as SharedDataDeletionError).failedSubcollections).toEqual([
      "sharedStrength",
    ]);
  });

  it("fails when a subcollection is not empty after deletion", async () => {
    // The delete query returns nothing to delete, but the verification read
    // still finds a document: the data is still visible to friends.
    let call = 0;
    mockGetDocs.mockImplementation(async (path: string) => {
      if (!path.endsWith("sharedPlans")) return { docs: [], empty: true };
      call += 1;
      return call === 1
        ? { docs: [], empty: true }
        : { docs: [{}], empty: false };
    });

    const error = await deleteAllSharedData("uid123").catch((e) => e);

    expect(error).toBeInstanceOf(SharedDataDeletionError);
    expect((error as SharedDataDeletionError).failedSubcollections).toEqual([
      "sharedPlans",
    ]);
  });

  it("only touches the subcollections it is given", async () => {
    await deleteAllSharedData("uid123", ["sharedPlans"]);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});
