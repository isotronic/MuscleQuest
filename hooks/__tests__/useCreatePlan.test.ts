import { renderHook, act } from "@testing-library/react-native";
import { useCreatePlan } from "../useCreatePlan";
import { updateWorkoutPlan, savePlanSchedule, openDatabase } from "@/utils/database";
import { publishPlan } from "@/utils/sharing";
import { useSocialStore } from "@/store/socialStore";
import { useWorkoutStore } from "@/store/workoutStore";

const mockUser = { uid: "user-123" };

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn(() => mockUser),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});

jest.mock("@/store/workoutStore", () => ({
  useWorkoutStore: jest.fn(),
}));

jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(),
}));

jest.mock("@/utils/database", () => ({
  insertWorkoutPlan: jest.fn(),
  openDatabase: jest.fn(),
  savePlanSchedule: jest.fn(() => Promise.resolve()),
  updateSettings: jest.fn(() => Promise.resolve()),
  updateWorkoutPlan: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/utils/sharing", () => ({
  publishPlan: jest.fn(() => Promise.resolve()),
  unpublishPlan: jest.fn(() => Promise.resolve()),
}));

// A getDoc that never resolves. If handleSavePlan's edit path still awaits
// this, the surrounding test would time out / never settle.
jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() => new Promise(() => {})),
}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: jest.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

describe("useCreatePlan - editing an existing plan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWorkoutStore as unknown as jest.Mock).mockReturnValue({
      workouts: [{ id: 1, name: "Workout A" }],
      planImageUrl: null,
      setPlanImageUrl: jest.fn(),
      planSchedule: {},
      clearDraft: jest.fn(),
    });
    (useSocialStore as unknown as jest.Mock).mockReturnValue({
      privacySettings: { sharePlans: false },
      publishedPlanIds: ["42"],
    });
    (openDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: jest.fn(() => Promise.resolve([])),
      getFirstAsync: jest.fn(() => Promise.resolve(null)),
      closeAsync: jest.fn(() => Promise.resolve()),
    });
  });

  it("resolves without hanging on a stalled Firestore read when saving an edited plan", async () => {
    const { result } = renderHook(() => useCreatePlan());

    act(() => {
      result.current.setPlanName("Push Day");
    });

    // planId is truthy and appPlanId is falsy -> this is the edit path.
    // Firestore's getDoc mock above never resolves; the save must not depend
    // on it settling.
    await act(async () => {
      await result.current.handleSavePlan(42, null);
    });

    expect(updateWorkoutPlan).toHaveBeenCalledWith(
      42,
      "Push Day",
      null,
      expect.any(Array),
    );
    expect(result.current.planSaved).toBe(true);
  });

  it("re-publishes an already-shared plan using the local socialStore cache instead of a Firestore read", async () => {
    const { result } = renderHook(() => useCreatePlan());

    act(() => {
      result.current.setPlanName("Push Day");
    });

    await act(async () => {
      await result.current.handleSavePlan(42, null);
    });

    expect(publishPlan).toHaveBeenCalledWith("user-123", 42);
  });

  it("does not re-publish a plan that isn't in the published set", async () => {
    (useSocialStore as unknown as jest.Mock).mockReturnValue({
      privacySettings: { sharePlans: false },
      publishedPlanIds: ["999"],
    });

    const { result } = renderHook(() => useCreatePlan());

    act(() => {
      result.current.setPlanName("Push Day");
    });

    await act(async () => {
      await result.current.handleSavePlan(42, null);
    });

    expect(publishPlan).not.toHaveBeenCalled();
  });
});
