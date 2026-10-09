import { useSocialSyncOnStartup } from "../useSocialSyncOnStartup";
import * as sharing from "@/utils/sharing";
import * as db from "@/utils/database";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";

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

// Called outside a renderer, so the store hook is a plain selector call.
const mockOwnership: Record<string, unknown> = {};
jest.mock("@/store/accountOwnershipStore", () => ({
  useAccountOwnershipStore: Object.assign(
    (selector: (s: unknown) => unknown) => selector(mockOwnership),
    {
      setState: (patch: object) => Object.assign(mockOwnership, patch),
      getState: () => mockOwnership,
    },
  ),
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
  useAccountOwnershipStore.setState({
    ownerUid: "my-uid",
    currentUid: "my-uid",
    resolvedFor: "my-uid",
    ownedByCurrentUser: true,
  });
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

it("skips the whole sync while the local data belongs to another account", async () => {
  useAccountOwnershipStore.setState({
    ownerUid: "someone-else",
    resolvedFor: "my-uid",
    ownedByCurrentUser: false,
  });
  (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([1, 4]);

  useSocialSyncOnStartup();
  await flush();

  expect(db.fetchAllPlanIds).not.toHaveBeenCalled();
  expect(db.fetchDeletedPlanIds).not.toHaveBeenCalled();
  expect(sharing.publishPlan).not.toHaveBeenCalled();
});

it("waits until ownership is known", async () => {
  useAccountOwnershipStore.setState({ resolvedFor: null });

  useSocialSyncOnStartup();
  await flush();

  expect(db.fetchDeletedPlanIds).not.toHaveBeenCalled();
});

it("does not publish when sharing is turned off while App Check settles", async () => {
  const { appCheckReady } = jest.requireMock("@/utils/initAppCheck");
  let settle!: () => void;
  (appCheckReady as jest.Mock).mockReturnValueOnce(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([1, 9]);
  (db.fetchAllStandaloneWorkoutIds as jest.Mock).mockResolvedValue([7, 10]);

  useSocialSyncOnStartup();
  mockStoreState = {
    ...mockStoreState,
    privacySettings: { sharePlans: false, shareStandaloneWorkouts: false },
  };
  settle();
  await flush();

  expect(sharing.publishPlan).not.toHaveBeenCalled();
  expect(sharing.publishStandaloneWorkout).not.toHaveBeenCalled();
});

it("stops publishing once sharing is turned off mid-sync", async () => {
  (db.fetchAllPlanIds as jest.Mock).mockResolvedValue([1, 9, 10]);
  // The first publish turns sharing off, as a toggle during the sync would.
  (sharing.publishPlan as jest.Mock).mockImplementationOnce(async () => {
    mockStoreState = {
      ...mockStoreState,
      privacySettings: { sharePlans: false, shareStandaloneWorkouts: true },
    };
  });

  useSocialSyncOnStartup();
  await flush();

  expect(sharing.publishPlan).toHaveBeenCalledTimes(1);
});
