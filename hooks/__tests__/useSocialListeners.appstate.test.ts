import { renderHook, act } from "@testing-library/react-native";
import { useSocialListeners } from "../useSocialListeners";
import { useSocialRefreshStore } from "@/store/socialRefreshStore";

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
  return {
    AuthContext: React.createContext({ uid: "my-uid" }),
    AuthLoadingContext: React.createContext(false),
  };
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

// Listeners subscribe once App Check has settled (mocked as resolved).
const flushAppCheck = () => act(async () => {});

describe("useSocialListeners - AppState-driven resubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandler = undefined;
  });

  it("re-subscribes all listeners when the app returns to the foreground", async () => {
    renderHook(() => useSocialListeners());
    await flushAppCheck();

    const initialSubscriptionCount = mockOnSnapshot.mock.calls.length;
    expect(initialSubscriptionCount).toBeGreaterThan(0);
    expect(mockUnsub).not.toHaveBeenCalled();

    act(() => {
      appStateHandler?.("active");
    });
    await flushAppCheck();

    // The previous round of listeners was torn down...
    expect(mockUnsub).toHaveBeenCalledTimes(initialSubscriptionCount);
    // ...and a fresh round was established.
    expect(mockOnSnapshot.mock.calls.length).toBe(initialSubscriptionCount * 2);
  });

  it("does not resubscribe for a transition to an inactive/background state", async () => {
    renderHook(() => useSocialListeners());
    await flushAppCheck();
    const initialSubscriptionCount = mockOnSnapshot.mock.calls.length;

    act(() => {
      appStateHandler?.("background");
    });

    expect(mockUnsub).not.toHaveBeenCalled();
    expect(mockOnSnapshot.mock.calls.length).toBe(initialSubscriptionCount);
  });

  it("re-subscribes all listeners when a screen asks for a refresh", async () => {
    renderHook(() => useSocialListeners());
    await flushAppCheck();
    const initialSubscriptionCount = mockOnSnapshot.mock.calls.length;

    act(() => {
      useSocialRefreshStore.getState().requestRefresh();
    });
    await flushAppCheck();

    expect(mockUnsub).toHaveBeenCalledTimes(initialSubscriptionCount);
    expect(mockOnSnapshot.mock.calls.length).toBe(initialSubscriptionCount * 2);
  });
});
