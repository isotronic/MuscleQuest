import { useSocialSyncOnStartup } from "../useSocialSyncOnStartup";

const mockDeleteAllSharedData = jest.fn();

jest.mock("@/utils/sharing", () => ({
  BULK_PUBLISH_CONCURRENCY: 4,
  publishPlan: jest.fn(),
  publishStandaloneWorkout: jest.fn(),
  pushCustomExercise: jest.fn(),
  deleteAllSharedData: (...args: unknown[]) => mockDeleteAllSharedData(...args),
}));

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts: string[]) => parts.join("/")),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

jest.mock("@/utils/database", () => ({
  fetchAllPlanIds: jest.fn().mockResolvedValue([]),
  fetchAllStandaloneWorkoutIds: jest.fn().mockResolvedValue([]),
  fetchAllCustomExercisesForSharing: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));

const mockSetPendingRevocation = jest.fn();
// The value the hook subscribes to, i.e. what useSocialStore() returns.
let mockStoreState: Record<string, unknown> = {};
// What getState() returns. Normally identical; a test can set them apart to
// pin which one a given branch reads.
let mockGetStateResult: Record<string, unknown> = {};

jest.mock("@/store/socialStore", () => ({
  useSocialStore: Object.assign(
    jest.fn(() => mockStoreState),
    { getState: () => mockGetStateResult },
  ),
}));

const mockUser = { uid: "my-uid" };
// Plain functions rather than jest.fn(): clearAllMocks() in beforeEach would
// strip a jest.fn()'s return value and the hook would see no signed-in user.
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
    privacySettings: {},
    publishedPlanIds: [],
    publishedWorkoutIds: [],
    pendingRevocation: null,
    setPendingRevocation: mockSetPendingRevocation,
  };
  mockGetStateResult = mockStoreState;
});

const setPendingRevocation = (revocation: unknown) => {
  mockStoreState = { ...mockStoreState, pendingRevocation: revocation };
  mockGetStateResult = mockStoreState;
};

describe("useSocialSyncOnStartup pending revocations", () => {
  it("does nothing when there is no pending revocation", async () => {
    useSocialSyncOnStartup();
    await flush();
    expect(mockDeleteAllSharedData).not.toHaveBeenCalled();
  });

  it("retries the persisted subcollections and clears them on success", async () => {
    setPendingRevocation({
      uid: "my-uid",
      subcollections: ["sharedPlans", "sharedStrength"],
    });
    mockDeleteAllSharedData.mockResolvedValue(undefined);

    useSocialSyncOnStartup();
    await flush();

    expect(mockDeleteAllSharedData).toHaveBeenCalledWith("my-uid", [
      "sharedPlans",
      "sharedStrength",
    ]);
    expect(mockSetPendingRevocation).toHaveBeenCalledWith(null);
  });

  it("keeps the still-failing subcollections for the next startup", async () => {
    setPendingRevocation({
      uid: "my-uid",
      subcollections: ["sharedPlans", "sharedStrength"],
    });
    mockDeleteAllSharedData.mockRejectedValue(
      Object.assign(new Error("permission-denied"), {
        failedSubcollections: ["sharedStrength"],
      }),
    );

    useSocialSyncOnStartup();
    await flush();

    expect(mockSetPendingRevocation).toHaveBeenCalledWith({
      uid: "my-uid",
      subcollections: ["sharedStrength"],
    });
  });

  // The store rehydrates from AsyncStorage after the first render, so the
  // effect must key off the subscribed value, which re-renders the hook when
  // rehydration lands. Reading it once from getState() kept the retry from
  // running at all on a launch where the user resolved first.
  //
  // The two mirrors are set apart here on purpose: the revocation is visible
  // only through the subscription, so this fails if the hook reads getState().
  it("retries a revocation that only the subscription can see", async () => {
    mockStoreState = {
      ...mockStoreState,
      pendingRevocation: { uid: "my-uid", subcollections: ["sharedPlans"] },
    };
    mockGetStateResult = {
      ...mockStoreState,
      pendingRevocation: null,
    };
    mockDeleteAllSharedData.mockResolvedValue(undefined);

    useSocialSyncOnStartup();
    await flush();

    expect(mockDeleteAllSharedData).toHaveBeenCalledWith("my-uid", [
      "sharedPlans",
    ]);
  });

  // The store is persisted, so a revocation outlives sign-out. Replaying it
  // against the next account would delete that person's shared data.
  it("discards a revocation left behind by a different account", async () => {
    setPendingRevocation({
      uid: "someone-else",
      subcollections: ["sharedPlans"],
    });

    useSocialSyncOnStartup();
    await flush();

    expect(mockDeleteAllSharedData).not.toHaveBeenCalled();
    expect(mockSetPendingRevocation).toHaveBeenCalledWith(null);
  });
});
