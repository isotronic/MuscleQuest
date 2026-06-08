import { useSocialListeners } from "../useSocialListeners";

// Capture onSnapshot callbacks so tests can trigger them
const snapshotCallbacks: Record<string, Function> = {};
const mockOnSnapshot = jest.fn((ref: string, cb: Function) => {
  snapshotCallbacks[ref] = cb;
  return jest.fn(); // unsubscribe
});

const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts) => parts.join("/")),
  doc: jest.fn((_db, ...parts) => parts.join("/")),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
}));

const mockSetFriends = jest.fn();
const mockSetPendingRequests = jest.fn();
const mockSetSentRequests = jest.fn();
const mockSetPrivacySettings = jest.fn();
const mockSetPublishedPlanIds = jest.fn();
const mockSetPublishedWorkoutIds = jest.fn();

jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({
    setFriends: mockSetFriends,
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
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

describe("useSocialListeners - friends backfill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(snapshotCallbacks).forEach((k) => delete snapshotCallbacks[k]);
    const { useContext } = jest.requireMock("react");
    useContext.mockReturnValue(mockUser);
    mockOnSnapshot.mockImplementation((ref: string, cb: Function) => {
      snapshotCallbacks[ref] = cb;
      return jest.fn();
    });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it("calls updateDoc to backfill profile when friends doc has no displayName", async () => {
    useSocialListeners();

    const friendsRef = "users/my-uid/friends";
    const friendsCallback = snapshotCallbacks[friendsRef];
    expect(friendsCallback).toBeDefined();

    // Doc has only `since` — no profile data yet
    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({ since: "2024-01-01" }),
        },
      ],
    };

    mockGetDoc.mockResolvedValue({
      data: () => ({
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/alice.jpg",
      }),
    });

    await friendsCallback(snapshot);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/my-uid/friends/friend-uid",
      {
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/alice.jpg",
      },
    );
  });

  it("still calls setFriends when getDoc fails during backfill", async () => {
    useSocialListeners();

    const friendsRef = "users/my-uid/friends";
    const friendsCallback = snapshotCallbacks[friendsRef];

    const snapshot = {
      docs: [{ id: "friend-uid", data: () => ({ since: "2024-01-01" }) }],
    };

    mockGetDoc.mockRejectedValue(new Error("network error"));

    await friendsCallback(snapshot);

    expect(mockSetFriends).toHaveBeenCalledWith([
      expect.objectContaining({ uid: "friend-uid", displayName: "" }),
    ]);
  });

  it("uses inline profile data and skips getDoc when displayName is present", async () => {
    useSocialListeners();

    const friendsRef = "users/my-uid/friends";
    const friendsCallback = snapshotCallbacks[friendsRef];

    const snapshot = {
      docs: [
        {
          id: "friend-uid",
          data: () => ({
            since: "2024-01-01",
            displayName: "Alice",
            email: "alice@example.com",
            photoURL: "https://example.com/alice.jpg",
          }),
        },
      ],
    };

    await friendsCallback(snapshot);

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetFriends).toHaveBeenCalledWith([
      {
        uid: "friend-uid",
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/alice.jpg",
        since: "2024-01-01",
      },
    ]);
  });
});
