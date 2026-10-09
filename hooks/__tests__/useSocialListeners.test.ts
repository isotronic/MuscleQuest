import { useSocialListeners } from "../useSocialListeners";

// Listeners subscribe once App Check has settled (mocked as resolved).
async function flushAppCheck() {
  await Promise.resolve();
  await Promise.resolve();
}

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
  deleteField: () => "__deleteField__",
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

jest.mock("@/store/socialRefreshStore", () => ({
  useSocialRefreshStore: jest.fn(() => 0),
}));

const mockUser = { uid: "my-uid" };

// useContext is mocked: the auth context yields the user, the auth loading
// context reports the session as restored.
function mockAuthContexts(user: unknown) {
  return (context: unknown) =>
    context === jest.requireMock("@/context/AuthProvider").AuthLoadingContext
      ? false
      : user;
}

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn(mockAuthContexts(mockUser)),
  useEffect: jest.fn((fn) => fn()),
  useState: jest.fn((initial: unknown) => [initial, jest.fn()]),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return {
    AuthContext: React.createContext(null),
    AuthLoadingContext: React.createContext(false),
  };
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
    jest
      .requireMock("react")
      .useContext.mockImplementation(mockAuthContexts(mockUser));
    mockOnSnapshot.mockImplementation(
      (ref: string, cb: Function, errCb?: Function) => {
        snapshotCallbacks[ref] = cb;
        if (errCb) errorCallbacks[ref] = errCb;
        return jest.fn();
      },
    );
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "",
      photoURL: "",
    });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  const friendsRef = "users/my-uid/friends";

  it("calls setFriends immediately using inline profile data when displayName is present", async () => {
    useSocialListeners();
    await flushAppCheck();
    const sinceDate = new Date("2024-01-01");
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => sinceDate },
            displayName: "Alice",
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
        photoURL: "https://example.com/alice.jpg",
        since: sinceDate.getTime(),
      },
    ]);
    expect(mockFetchFriendProfile).not.toHaveBeenCalled();
  });

  it("calls setFriends immediately with empty profile when displayName is absent", async () => {
    useSocialListeners();
    await flushAppCheck();
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

  it("calls fetchFriendProfile in background for docs without displayName", async () => {
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "Alice",
      photoURL: "",
    });
    useSocialListeners();
    await flushAppCheck();
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

  it("calls fetchFriendProfile in background for docs with displayName but missing photoURL", async () => {
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "Alice",
      photoURL: "https://example.com/alice.jpg",
    });
    useSocialListeners();
    await flushAppCheck();
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
      photoURL: "https://example.com/alice.jpg",
    };
    mockFetchFriendProfile.mockResolvedValue(profile);
    useSocialListeners();
    await flushAppCheck();
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

  // A write allowlist stops new writes; it does not clean documents that are
  // already there, and the rules now reject any write to one that still has
  // the field.
  it("clears a legacy email off a friend record", async () => {
    useSocialListeners();
    await flushAppCheck();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => new Date("2024-01-01") },
            displayName: "Alice",
            photoURL: "https://example.com/alice.jpg",
            email: "alice@example.com",
          }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    await Promise.resolve();

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/my-uid/friends/friend-uid",
      { email: "__deleteField__" },
    );
    // Nothing else was missing, so no profile fetch was needed.
    expect(mockFetchFriendProfile).not.toHaveBeenCalled();
  });

  it("leaves a friend record with no legacy email untouched", async () => {
    useSocialListeners();
    await flushAppCheck();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => new Date("2024-01-01") },
            displayName: "Alice",
            photoURL: "https://example.com/alice.jpg",
          }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    await Promise.resolve();

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // Not reachable through any shipped writer: the backfill that added `email`
  // wrote all three fields in one updateDoc, so a record with the field always
  // has the other two. Guarded anyway, because the rules reject every write to
  // a record that still carries it, so one left behind here could never be
  // written again.
  it("still clears the legacy email when the profile fetch fails", async () => {
    mockFetchFriendProfile.mockRejectedValue(new Error("unreachable"));
    useSocialListeners();
    await flushAppCheck();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => new Date("2024-01-01") },
            email: "alice@example.com",
          }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/my-uid/friends/friend-uid",
      { email: "__deleteField__" },
    );
  });

  it("clears the legacy email in the same write as a profile backfill", async () => {
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "Alice",
      photoURL: "https://example.com/alice.jpg",
    });
    useSocialListeners();
    await flushAppCheck();
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: { toDate: () => new Date("2024-01-01") },
            email: "alice@example.com",
          }),
        },
      ],
    };

    snapshotCallbacks[friendsRef](snapshot);
    await Promise.resolve();

    // One write, not two: a backfill that left the field in place would be
    // rejected by the rules.
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/my-uid/friends/friend-uid",
      {
        displayName: "Alice",
        photoURL: "https://example.com/alice.jpg",
        email: "__deleteField__",
      },
    );
  });

  it("does not throw when fetchFriendProfile exhausts all retries", async () => {
    mockFetchFriendProfile.mockRejectedValue(new Error("unreachable"));
    useSocialListeners();
    await flushAppCheck();
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
    await flushAppCheck();
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
      photoURL: "https://example.com/alice.jpg",
    };
    mockFetchFriendProfile.mockResolvedValue(profile);
    const writeError = new Error("write failed");
    mockUpdateDoc.mockRejectedValue(writeError);
    useSocialListeners();
    await flushAppCheck();
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
    jest
      .requireMock("react")
      .useContext.mockImplementation(mockAuthContexts(mockUser));
    mockOnSnapshot.mockImplementation(
      (ref: string, cb: Function, errCb?: Function) => {
        snapshotCallbacks[ref] = cb;
        if (errCb) errorCallbacks[ref] = errCb;
        return jest.fn();
      },
    );
    mockFetchFriendProfile.mockResolvedValue({
      displayName: "",
      photoURL: "",
    });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  const sharedPlansRef = "users/my-uid/sharedPlans";
  const settingsRef = "users/my-uid/private/settings";

  it("resets only publishedPlanIds when the sharedPlans listener gets permission-denied, leaving other state untouched", async () => {
    useSocialListeners();
    await flushAppCheck();
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

  it("resets only privacySettings when the settings listener gets permission-denied", async () => {
    useSocialListeners();
    await flushAppCheck();
    const error = Object.assign(new Error("denied"), {
      code: "firestore/permission-denied",
    });

    errorCallbacks[settingsRef](error);

    expect(mockSetPrivacySettings).toHaveBeenCalledWith(null);
    expect(mockSetPublishedPlanIds).not.toHaveBeenCalled();
    expect(mockSetPublishedWorkoutIds).not.toHaveBeenCalled();
    expect(mockSetFriends).not.toHaveBeenCalled();
  });

  it("reports permission-denied errors to Bugsnag instead of swallowing them", async () => {
    useSocialListeners();
    await flushAppCheck();
    const Bugsnag = jest.requireMock("@bugsnag/expo").default;
    const error = Object.assign(new Error("denied"), {
      code: "firestore/permission-denied",
    });

    errorCallbacks[sharedPlansRef](error);

    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error, expect.any(Function));
  });

  it("still reports non-permission-denied errors to Bugsnag without resetting any state", async () => {
    useSocialListeners();
    await flushAppCheck();
    const Bugsnag = jest.requireMock("@bugsnag/expo").default;
    const error = new Error("network hiccup");

    errorCallbacks[sharedPlansRef](error);

    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(mockSetPublishedPlanIds).not.toHaveBeenCalled();
  });
});

describe("useSocialListeners - before the session is restored", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest
      .requireMock("react")
      .useContext.mockImplementation(mockAuthContexts(mockUser));
  });

  const authLoading = (context: unknown) =>
    context === jest.requireMock("@/context/AuthProvider").AuthLoadingContext
      ? true
      : null;

  it("keeps the persisted social state while auth is loading", async () => {
    jest.requireMock("react").useContext.mockImplementation(authLoading);

    useSocialListeners();
    await flushAppCheck();

    expect(mockSetFriends).not.toHaveBeenCalled();
    expect(mockSetPrivacySettings).not.toHaveBeenCalled();
    expect(mockSetPublishedPlanIds).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("clears the social state once auth reports signed out", async () => {
    jest
      .requireMock("react")
      .useContext.mockImplementation(mockAuthContexts(null));

    useSocialListeners();
    await flushAppCheck();

    expect(mockSetFriends).toHaveBeenCalledWith([]);
    expect(mockSetPrivacySettings).toHaveBeenCalledWith(null);
    expect(mockSetPublishedPlanIds).toHaveBeenCalledWith(null);
  });
});

describe("useSocialListeners - request hydration", () => {
  const getDocMock = () =>
    jest.requireMock("@react-native-firebase/firestore").getDoc as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(snapshotCallbacks).forEach((k) => delete snapshotCallbacks[k]);
    jest
      .requireMock("react")
      .useContext.mockImplementation(mockAuthContexts(mockUser));
    mockOnSnapshot.mockImplementation((ref: string, cb: Function) => {
      snapshotCallbacks[ref] = cb;
      return jest.fn();
    });
  });

  // A profile read that fails or times out must cost only that sender's
  // name, not the whole list of requests.
  it("keeps every request when one sender's profile cannot be read", async () => {
    getDocMock().mockImplementation((path: string) =>
      path === "users/alice"
        ? Promise.resolve({ data: () => ({ displayName: "Alice" }) })
        : Promise.reject(new Error("unavailable")),
    );
    useSocialListeners();
    await flushAppCheck();

    // Incoming and sent requests both query friendRequests; incoming is first.
    const onPending = mockOnSnapshot.mock.calls.find(
      ([ref]) => ref === "friendRequests",
    )![1];
    await onPending({
      docs: [
        { id: "r1", data: () => ({ from: "alice", to: "my-uid" }) },
        { id: "r2", data: () => ({ from: "bob", to: "my-uid" }) },
      ],
    });

    expect(mockSetPendingRequests).toHaveBeenCalledWith([
      expect.objectContaining({ id: "r1", displayName: "Alice" }),
      expect.objectContaining({ id: "r2", fromUid: "bob", displayName: "" }),
    ]);
  });
});

describe("useSocialListeners - App Check", () => {
  const appCheckReady = () =>
    jest.requireMock("@/utils/initAppCheck").appCheckReady as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .requireMock("react")
      .useContext.mockImplementation(mockAuthContexts(mockUser));
  });

  afterEach(() => {
    appCheckReady().mockImplementation(() => Promise.resolve());
  });

  it("does not subscribe until App Check has settled", async () => {
    let settle!: () => void;
    appCheckReady().mockReturnValueOnce(
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
    );

    useSocialListeners();
    await flushAppCheck();
    expect(mockOnSnapshot).not.toHaveBeenCalled();

    settle();
    await flushAppCheck();
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it("never subscribes when torn down before App Check settles", async () => {
    let settle!: () => void;
    appCheckReady().mockReturnValueOnce(
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
    );
    let cleanup: (() => void) | undefined;
    jest
      .requireMock("react")
      .useEffect.mockImplementation((fn: () => unknown) => {
        const result = fn();
        if (typeof result === "function") cleanup = result as () => void;
      });

    try {
      useSocialListeners();
      cleanup?.();
      settle();
      await flushAppCheck();
    } finally {
      jest
        .requireMock("react")
        .useEffect.mockImplementation((fn: () => unknown) => fn());
    }

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});
