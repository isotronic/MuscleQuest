import { renderHook, act } from "@testing-library/react-native";
import { useSocialListeners } from "../useSocialListeners";
import { useSocialRefreshStore } from "@/store/socialRefreshStore";

type SnapshotCb = (snap: unknown) => Promise<void> | void;
const mockSnapshotCallbacks: SnapshotCb[] = [];
let mockResolveGetDoc: (value: unknown) => void = () => {};

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts) => parts.join("/")),
  doc: jest.fn((_db, ...parts) => parts.join("/")),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  onSnapshot: jest.fn((_ref: unknown, onNext: SnapshotCb) => {
    mockSnapshotCallbacks.push(onNext);
    return jest.fn();
  }),
  getDoc: jest.fn(
    () =>
      new Promise((resolve) => {
        mockResolveGetDoc = resolve;
      }),
  ),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteField: jest.fn(),
}));
jest.mock("@/utils/fetchFriendProfile", () => ({
  fetchFriendProfile: jest.fn(),
}));

const mockSetPendingRequests = jest.fn();
const mockStore = {
  setFriends: jest.fn(),
  updateFriendProfile: jest.fn(),
  setPendingRequests: mockSetPendingRequests,
  setSentRequests: jest.fn(),
  setPrivacySettings: jest.fn(),
  setPublishedPlanIds: jest.fn(),
  setPublishedWorkoutIds: jest.fn(),
};
jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => mockStore),
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

describe("useSocialListeners after a resubscribe", () => {
  it("ignores request lookups that finish after their listener was torn down", async () => {
    renderHook(() => useSocialListeners());
    // The first onSnapshot registered is the incoming pending requests one.
    const stalePendingCallback = mockSnapshotCallbacks[0];

    const pending = stalePendingCallback({
      docs: [
        {
          id: "req-1",
          data: () => ({ from: "friend-uid", createdAt: null }),
        },
      ],
    });

    act(() => {
      useSocialRefreshStore.getState().requestRefresh();
    });

    await act(async () => {
      mockResolveGetDoc({ data: () => ({ displayName: "Old" }) });
      await pending;
    });

    expect(mockSetPendingRequests).not.toHaveBeenCalled();
  });
});
