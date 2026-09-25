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

const mockSetPendingRevocations = jest.fn();
let mockStoreState: Record<string, unknown> = {};

jest.mock("@/store/socialStore", () => ({
  useSocialStore: Object.assign(
    jest.fn(() => mockStoreState),
    { getState: () => mockStoreState },
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
    pendingRevocations: [],
    setPendingRevocations: mockSetPendingRevocations,
  };
});

describe("useSocialSyncOnStartup pending revocations", () => {
  it("does nothing when there is no pending revocation", async () => {
    useSocialSyncOnStartup();
    await flush();
    expect(mockDeleteAllSharedData).not.toHaveBeenCalled();
  });

  it("retries the persisted subcollections and clears them on success", async () => {
    mockStoreState.pendingRevocations = ["sharedPlans", "sharedStrength"];
    mockDeleteAllSharedData.mockResolvedValue(undefined);

    useSocialSyncOnStartup();
    await flush();

    expect(mockDeleteAllSharedData).toHaveBeenCalledWith("my-uid", [
      "sharedPlans",
      "sharedStrength",
    ]);
    expect(mockSetPendingRevocations).toHaveBeenCalledWith([]);
  });

  it("keeps the still-failing subcollections for the next startup", async () => {
    mockStoreState.pendingRevocations = ["sharedPlans", "sharedStrength"];
    mockDeleteAllSharedData.mockRejectedValue(
      Object.assign(new Error("permission-denied"), {
        failedSubcollections: ["sharedStrength"],
      }),
    );

    useSocialSyncOnStartup();
    await flush();

    expect(mockSetPendingRevocations).toHaveBeenCalledWith(["sharedStrength"]);
  });
});
