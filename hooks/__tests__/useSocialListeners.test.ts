import { useSocialListeners } from "../useSocialListeners";

const snapshotCallbacks: Record<string, Function> = {};
const errorCallbacks: Record<string, Function> = {};
const mockOnSnapshot = jest.fn(
  (ref: string, cb: Function, errCb?: Function) => {
    snapshotCallbacks[ref] = cb;
    if (errCb) errorCallbacks[ref] = errCb;
    return jest.fn();
  },
);

const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts) => parts.join("/")),
  doc: jest.fn((_db, ...parts) => parts.join("/")),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  onSnapshot: (...args: any[]) => (mockOnSnapshot as any)(...args),
  getDoc: jest.fn(),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
}));

const mockFetchFriendProfile = jest.fn();
jest.mock("@/utils/fetchFriendProfile", () => ({
  fetchFriendProfile: (...args: any[]) => mockFetchFriendProfile(...args),
}));

const mockSetFriends = jest.fn();
const mockUpdateFriendProfile = jest.fn();
const mockSetPendingRequests = jest.fn();
const mockSetSentRequests = jest.fn();
const mockSetPrivacySettings = jest.fn();
const mockSetPublishedPlanIds = jest.fn();
const mockSetPublishedWorkoutIds = jest.fn();

jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({
    setFriends: mockSetFriends,
    updateFriendProfile: mockUpdateFriendProfile,
    setPendingRequests: mockSetPendingRequests,
    setSentRequests: mockSetSentRequests,
    setPrivacySettings: mockSetPrivacySettings,
    setPublishedPlanIds: mockSetPublishedPlanIds,
    setPublishedWorkoutIds: mockSetPublishedWorkoutIds,
  })),
}));

const mockUser = { uid: "my-uid" };

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(mockUser),
  useEffect: jest.fn((fn) => fn()),
  useState: jest.fn((initial: unknown) => [initial, jest.fn()]),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("react-native", () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

describe("useSocialListeners - friends snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(snapshotCallbacks).forEach((k) => delete snapshotCallbacks[k]);
    Object.keys(errorCallbacks).forEach((k) => delete errorCallbacks[k]);
    jest.requireMock("react").useContext.mockReturnValue(mockUser);
    mockOnSnapshot.mockImplementation(
      (ref: string, cb: Function, errCb?: Function) => {
        snapshotCallbacks[ref] = cb;
        if (errCb) errorCallbacks[ref] = errCb;
        return jest.fn();
      },
    );
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "",
      email: "",
      photoURL: "",
    });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  const friendsRef = "users/my-uid/friends";

  it("calls setFriends immediately using inline profile data when displayName is present", () => {
    useSocialListeners();
    const sinceDate = new Date("2024-01-01");
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => sinceDate },
            displayName: "Alice",
            email: "alice@example.com",
            photoURL: "https://example.com/alice.jpg",
          }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);

    expect(mockSetFriends).toHaveBeenCalledWith([
      {
        uid: "friend-uid",
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/alice.jpg",
        since: sinceDate.getTime(),
      },
    ]);
    expect(mockFetchFriendProfile).not.toHaveBeenCalled();
  });

  it("calls setFriends immediately with empty profile when displayName is absent", () => {
    useSocialListeners();
    const sinceDate = new Date("2024-01-01");
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: { toDate: () => sinceDate } }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);

    expect(mockSetFriends).toHaveBeenCalledWith([
      expect.objectContaining({ uid: "friend-uid", displayName: "" }),
    ]);
  });

  it("calls fetchFriendProfile in background for docs without displayName", () => {
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "Alice",
      email: "",
      photoURL: "",
    });
    useSocialListeners();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: { toDate: () => new Date("2024-01-01") } }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);

    expect(mockFetchFriendProfile).toHaveBeenCalledWith("friend-uid");
  });

  it("calls fetchFriendProfile in background for docs with displayName but missing email or photoURL", () => {
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "https://example.com/alice.jpg",
    });
    useSocialListeners();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => new Date("2024-01-01") },
            displayName: "Alice",
          }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);

    expect(mockFetchFriendProfile).toHaveBeenCalledWith("friend-uid");
  });

  it("calls updateFriendProfile and backfills Firestore when fetch succeeds", async () => {
    const profile = {
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "https://example.com/alice.jpg",
    };
    mockFetchFriendProfile.mockResolvedValue(profile);
    useSocialListeners();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: { toDate: () => new Date("2024-01-01") } }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    await Promise.resolve(); // flush microtasks

    expect(mockUpdateFriendProfile).toHaveBeenCalledWith("friend-uid", profile);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/my-uid/friends/friend-uid",
      profile,
    );
  });

  it("does not throw when fetchFriendProfile exhausts all retries", async () => {
    mockFetchFriendProfile.mockRejectedValue(new Error("unreachable"));
    useSocialListeners();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: { toDate: () => new Date("2024-01-01") } }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    await Promise.resolve();

    // setFriends was already called with empty profile — no crash
    expect(mockSetFriends).toHaveBeenCalledTimes(1);
    expect(mockUpdateFriendProfile).not.toHaveBeenCalled();
  });

  it("reports to Bugsnag when the background friend-profile fetch fails instead of swallowing it", async () => {
    const Bugsnag = jest.requireMock("@bugsnag/expo").default;
    const error = new Error("unreachable");
    mockFetchFriendProfile.mockRejectedValue(error);
    useSocialListeners();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: { toDate: () => new Date("2024-01-01") } }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    // Flush the fetch rejection and its catch handler.
    await Promise.resolve();
    await Promise.resolve();

    expect(Bugsnag.notify).toHaveBeenCalledWith(error, expect.any(Function));
  });

  it("reports to Bugsnag when the Firestore profile backfill write fails", async () => {
    const Bugsnag = jest.requireMock("@bugsnag/expo").default;
    const profile = {
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "https://example.com/alice.jpg",
    };
    mockFetchFriendProfile.mockResolvedValue(profile);
    const writeError = new Error("write failed");
    mockUpdateDoc.mockRejectedValue(writeError);
    useSocialListeners();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: { toDate: () => new Date("2024-01-01") } }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    // Flush the fetch resolution, the write rejection, and its catch handler.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(Bugsnag.notify).toHaveBeenCalledWith(
      writeError,
      expect.any(Function),
    );
  });
});

describe("useSocialListeners - listener error scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(snapshotCallbacks).forEach((k) => delete snapshotCallbacks[k]);
    Object.keys(errorCallbacks).forEach((k) => delete errorCallbacks[k]);
    jest.requireMock("react").useContext.mockReturnValue(mockUser);
    mockOnSnapshot.mockImplementation(
      (ref: string, cb: Function, errCb?: Function) => {
        snapshotCallbacks[ref] = cb;
        if (errCb) errorCallbacks[ref] = errCb;
        return jest.fn();
      },
    );
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "",
      email: "",
      photoURL: "",
    });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  const sharedPlansRef = "users/my-uid/sharedPlans";
  const settingsRef = "users/my-uid/private/settings";

  it("resets only publishedPlanIds when the sharedPlans listener gets permission-denied, leaving other state untouched", () => {
    useSocialListeners();
    const error = Object.assign(new Error("denied"), {
      code: "firestore/permission-denied",
    });

    errorCallbacks[sharedPlansRef](error);

    expect(mockSetPublishedPlanIds).toHaveBeenCalledWith(null);
    expect(mockSetPrivacySettings).not.toHaveBeenCalled();
    expect(mockSetFriends).not.toHaveBeenCalled();
    expect(mockSetPendingRequests).not.toHaveBeenCalled();
    expect(mockSetSentRequests).not.toHaveBeenCalled();
    expect(mockSetPublishedWorkoutIds).not.toHaveBeenCalled();
  });

  it("resets only privacySettings when the settings listener gets permission-denied", () => {
    useSocialListeners();
    const error = Object.assign(new Error("denied"), {
      code: "firestore/permission-denied",
    });

    errorCallbacks[settingsRef](error);

    expect(mockSetPrivacySettings).toHaveBeenCalledWith(null);
    expect(mockSetPublishedPlanIds).not.toHaveBeenCalled();
    expect(mockSetPublishedWorkoutIds).not.toHaveBeenCalled();
    expect(mockSetFriends).not.toHaveBeenCalled();
  });

  it("reports permission-denied errors to Bugsnag instead of swallowing them", () => {
    useSocialListeners();
    const Bugsnag = jest.requireMock("@bugsnag/expo").default;
    const error = Object.assign(new Error("denied"), {
      code: "firestore/permission-denied",
    });

    errorCallbacks[sharedPlansRef](error);

    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error, expect.any(Function));
  });

  it("still reports non-permission-denied errors to Bugsnag without resetting any state", () => {
    useSocialListeners();
    const Bugsnag = jest.requireMock("@bugsnag/expo").default;
    const error = new Error("network hiccup");

    errorCallbacks[sharedPlansRef](error);

    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(mockSetPublishedPlanIds).not.toHaveBeenCalled();
  });
});
