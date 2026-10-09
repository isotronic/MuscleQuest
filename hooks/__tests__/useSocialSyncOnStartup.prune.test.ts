import { useSocialSyncOnStartup } from "../useSocialSyncOnStartup";
import * as sharing from "@/utils/sharing";
import * as db from "@/utils/database";

jest.mock("@/utils/sharing", () => ({
  BULK_PUBLISH_CONCURRENCY: 4,
  publishPlan: jest.fn().mockResolvedValue(undefined),
  unpublishPlan: jest.fn().mockResolvedValue(undefined),
  publishStandaloneWorkout: jest.fn().mockResolvedValue(undefined),
  unpublishStandaloneWorkout: jest.fn().mockResolvedValue(undefined),
  pushCustomExercise: jest.fn(),
  deleteAllSharedData: jest.fn(),
}));

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts: string[]) => parts.join("/")),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

jest.mock("@/utils/database", () => ({
  fetchAllPlanIds: jest.fn(),
  fetchAllStandaloneWorkoutIds: jest.fn(),
  fetchDeletedPlanIds: jest.fn(),
  fetchDeletedStandaloneWorkoutIds: jest.fn(),
  fetchAllCustomExercisesForSharing: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));

let mockStoreState: Record<string, unknown> = {};
jest.mock("@/store/socialStore", () => ({
  useSocialStore: Object.assign(
    jest.fn(() => mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

const mockUser = { uid: "my-uid" };
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: () => mockUser,
  useEffect: (fn: () => void) => fn(),
  useRef: () => ({ current: false }),
}));
jest.mock("@/context/AuthProvider", () => ({ AuthContext: {} }));

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState = {
    privacySettings: { sharePlans: true, shareStandaloneWorkouts: true },
    publishedPlanIds: ["1", "2", "3"],
    publishedWorkoutIds: ["7", "8"],
    pendingRevocation: null,
  };
  (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([1]);
  (db.fetchDeletedPlanIds as jest.Mock).mockResolvedValue([2, 5]);
  (db.fetchAllStandaloneWorkoutIds as jest.Mock).mockResolvedValue([7]);
  (db.fetchDeletedStandaloneWorkoutIds as jest.Mock).mockResolvedValue([8]);
});

it("unpublishes published plans that are soft-deleted locally", async () => {
  useSocialSyncOnStartup();
  await flush();

  expect(sharing.unpublishPlan).toHaveBeenCalledTimes(1);
  expect(sharing.unpublishPlan).toHaveBeenCalledWith("my-uid", 2);
});

it("unpublishes published standalone workouts that are soft-deleted locally", async () => {
  useSocialSyncOnStartup();
  await flush();

  expect(sharing.unpublishStandaloneWorkout).toHaveBeenCalledTimes(1);
  expect(sharing.unpublishStandaloneWorkout).toHaveBeenCalledWith("my-uid", 8);
});

// Plan 3 is not in this database at all: it may belong to another install of
// the same account, so it is left alone.
it("leaves published ids the local database does not know", async () => {
  useSocialSyncOnStartup();
  await flush();

  expect(sharing.unpublishPlan).not.toHaveBeenCalledWith("my-uid", 3);
});

it("prunes even when the category toggle is off", async () => {
  mockStoreState = {
    ...mockStoreState,
    privacySettings: { sharePlans: false, shareStandaloneWorkouts: false },
  };

  useSocialSyncOnStartup();
  await flush();

  expect(sharing.unpublishPlan).toHaveBeenCalledWith("my-uid", 2);
  expect(sharing.publishPlan).not.toHaveBeenCalled();
});
