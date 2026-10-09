import {
  syncCompletedWorkoutChanged,
  syncCompletedWorkoutRemoved,
  syncMeasurementChanged,
  syncMeasurementRemoved,
  syncPlanRemoved,
  syncPlanRestored,
  syncStandaloneWorkoutRemoved,
  syncStandaloneWorkoutRestored,
} from "../sharedSync";
import * as sharing from "../sharing";
import * as db from "@/utils/database";
import { useSocialStore } from "@/store/socialStore";
import { getAuth } from "@react-native-firebase/auth";
import type { FirestorePrivateSettings } from "@/types/firestore";

jest.mock("../sharing", () => ({
  pushCompletedWorkout: jest.fn().mockResolvedValue(undefined),
  unpublishCompletedWorkout: jest.fn().mockResolvedValue(undefined),
  refreshStrengthPRs: jest.fn().mockResolvedValue(undefined),
  pushBodyMeasurement: jest.fn().mockResolvedValue(undefined),
  unpublishBodyMeasurement: jest.fn().mockResolvedValue(undefined),
  publishPlan: jest.fn().mockResolvedValue(undefined),
  unpublishPlan: jest.fn().mockResolvedValue(undefined),
  publishStandaloneWorkout: jest.fn().mockResolvedValue(undefined),
  unpublishStandaloneWorkout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/database", () => ({
  fetchCompletedWorkoutExerciseIds: jest.fn(),
}));

const allOn: FirestorePrivateSettings = {
  sharePlans: true,
  shareStandaloneWorkouts: true,
  shareCustomExercises: true,
  shareCompletedWorkouts: true,
  shareBodyMeasurements: true,
  shareStrengthProgress: true,
};

const allOff: FirestorePrivateSettings = {
  sharePlans: false,
  shareStandaloneWorkouts: false,
  shareCustomExercises: false,
  shareCompletedWorkouts: false,
  shareBodyMeasurements: false,
  shareStrengthProgress: false,
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const auth = getAuth() as unknown as { currentUser: { uid: string } | null };

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { uid: "me" };
  useSocialStore.setState({
    privacySettings: allOn,
    publishedPlanIds: [],
    publishedWorkoutIds: [],
  });
  (db.fetchCompletedWorkoutExerciseIds as jest.Mock).mockResolvedValue([3, 4]);
});

describe("completed workouts", () => {
  it("unpublishes a deleted workout and refreshes its exercises' PRs", async () => {
    syncCompletedWorkoutRemoved(10);
    await flush();

    expect(sharing.unpublishCompletedWorkout).toHaveBeenCalledWith("me", 10);
    expect(sharing.refreshStrengthPRs).toHaveBeenCalledWith("me", [3, 4]);
  });

  it("re-pushes an edited or restored workout", async () => {
    syncCompletedWorkoutChanged(10, [5]);
    await flush();

    expect(sharing.pushCompletedWorkout).toHaveBeenCalledWith("me", 10);
    // An exercise swapped out by the edit loses its PR from this workout too.
    expect(sharing.refreshStrengthPRs).toHaveBeenCalledWith("me", [3, 4, 5]);
  });

  it("does nothing when sharing is off", async () => {
    useSocialStore.setState({ privacySettings: allOff });

    syncCompletedWorkoutRemoved(10);
    syncCompletedWorkoutChanged(10);
    await flush();

    expect(sharing.unpublishCompletedWorkout).not.toHaveBeenCalled();
    expect(sharing.pushCompletedWorkout).not.toHaveBeenCalled();
    expect(sharing.refreshStrengthPRs).not.toHaveBeenCalled();
  });

  it("does nothing when signed out", async () => {
    auth.currentUser = null;

    syncCompletedWorkoutRemoved(10);
    await flush();

    expect(sharing.unpublishCompletedWorkout).not.toHaveBeenCalled();
  });

  it("handles each toggle on its own", async () => {
    useSocialStore.setState({
      privacySettings: { ...allOff, shareStrengthProgress: true },
    });

    syncCompletedWorkoutRemoved(10);
    await flush();

    expect(sharing.unpublishCompletedWorkout).not.toHaveBeenCalled();
    expect(sharing.refreshStrengthPRs).toHaveBeenCalled();
  });
});

describe("body measurements", () => {
  it("re-pushes an updated measurement", () => {
    syncMeasurementChanged(7);
    expect(sharing.pushBodyMeasurement).toHaveBeenCalledWith("me", 7);
  });

  it("unpublishes a deleted measurement", () => {
    syncMeasurementRemoved(7);
    expect(sharing.unpublishBodyMeasurement).toHaveBeenCalledWith("me", 7);
  });

  it("does nothing when sharing is off", () => {
    useSocialStore.setState({ privacySettings: allOff });
    syncMeasurementChanged(7);
    syncMeasurementRemoved(7);
    expect(sharing.pushBodyMeasurement).not.toHaveBeenCalled();
    expect(sharing.unpublishBodyMeasurement).not.toHaveBeenCalled();
  });
});

describe("plans", () => {
  it("unpublishes a published plan and republishes it on undo", () => {
    useSocialStore.setState({ publishedPlanIds: ["2"] });

    const wasPublished = syncPlanRemoved(2);
    expect(wasPublished).toBe(true);
    expect(sharing.unpublishPlan).toHaveBeenCalledWith("me", 2);

    syncPlanRestored(2, wasPublished);
    expect(sharing.publishPlan).toHaveBeenCalledWith("me", 2);
  });

  it("leaves an unpublished plan alone", () => {
    useSocialStore.setState({ publishedPlanIds: ["9"] });

    const wasPublished = syncPlanRemoved(2);
    syncPlanRestored(2, wasPublished);

    expect(wasPublished).toBe(false);
    expect(sharing.unpublishPlan).not.toHaveBeenCalled();
    expect(sharing.publishPlan).not.toHaveBeenCalled();
  });

  // Before the listener hydrates nobody knows; deleting a missing doc is
  // harmless, leaving a published one visible is not.
  it("unpublishes when the published list has not hydrated", () => {
    useSocialStore.setState({ publishedPlanIds: null });
    syncPlanRemoved(2);
    expect(sharing.unpublishPlan).toHaveBeenCalledWith("me", 2);
  });
});

describe("standalone workouts", () => {
  it("unpublishes a published workout and republishes it on undo", () => {
    useSocialStore.setState({ publishedWorkoutIds: ["6"] });

    const wasPublished = syncStandaloneWorkoutRemoved(6);
    syncStandaloneWorkoutRestored(6, wasPublished);

    expect(sharing.unpublishStandaloneWorkout).toHaveBeenCalledWith("me", 6);
    expect(sharing.publishStandaloneWorkout).toHaveBeenCalledWith("me", 6);
  });

  it("leaves an unpublished workout alone", () => {
    useSocialStore.setState({ publishedWorkoutIds: [] });
    syncStandaloneWorkoutRemoved(6);
    expect(sharing.unpublishStandaloneWorkout).not.toHaveBeenCalled();
  });
});
