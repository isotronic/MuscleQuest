import { renderHook, act } from "@testing-library/react-native";
import { useSocialListeners } from "../useSocialListeners";

const mockUnsub = jest.fn();
const mockOnSnapshot = jest.fn(() => mockUnsub);

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts) => parts.join("/")),
  doc: jest.fn((_db, ...parts) => parts.join("/")),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  onSnapshot: (...args: any[]) => (mockOnSnapshot as any)(...args),
  getDoc: jest.fn(),
  updateDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/fetchFriendProfile", () => ({
  fetchFriendProfile: jest.fn().mockResolvedValue({
    displayName: "",
    email: "",
    photoURL: "",
  }),
}));

jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({
    setFriends: jest.fn(),
    updateFriendProfile: jest.fn(),
    setPendingRequests: jest.fn(),
    setSentRequests: jest.fn(),
    setPrivacySettings: jest.fn(),
    setPublishedPlanIds: jest.fn(),
    setPublishedWorkoutIds: jest.fn(),
  })),
}));

jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext({ uid: "my-uid" }) };
});

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

let appStateHandler: ((state: string) => void) | undefined;
const mockAppStateRemove = jest.fn();
jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn((_event: string, handler: any) => {
      appStateHandler = handler;
      return { remove: mockAppStateRemove };
    }),
  },
}));

describe("useSocialListeners - AppState-driven resubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandler = undefined;
  });

  it("re-subscribes all listeners when the app returns to the foreground", () => {
    renderHook(() => useSocialListeners());

    const initialSubscriptionCount = mockOnSnapshot.mock.calls.length;
    expect(initialSubscriptionCount).toBeGreaterThan(0);
    expect(mockUnsub).not.toHaveBeenCalled();

    act(() => {
      appStateHandler?.("active");
    });

    // The previous round of listeners was torn down...
    expect(mockUnsub).toHaveBeenCalledTimes(initialSubscriptionCount);
    // ...and a fresh round was established.
    expect(mockOnSnapshot.mock.calls.length).toBe(initialSubscriptionCount * 2);
  });

  it("does not resubscribe for a transition to an inactive/background state", () => {
    renderHook(() => useSocialListeners());
    const initialSubscriptionCount = mockOnSnapshot.mock.calls.length;

    act(() => {
      appStateHandler?.("background");
    });

    expect(mockUnsub).not.toHaveBeenCalled();
    expect(mockOnSnapshot.mock.calls.length).toBe(initialSubscriptionCount);
  });
});
