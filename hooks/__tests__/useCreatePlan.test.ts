import { renderHook, act } from "@testing-library/react-native";
import { useCreatePlan } from "../useCreatePlan";
import {
  updateWorkoutPlan,
  openDatabase,
  savePlanSchedule,
  updateSettings,
} from "@/utils/database";
import { publishPlan } from "@/utils/sharing";
import { useSocialStore } from "@/store/socialStore";
import { useWorkoutStore } from "@/store/workoutStore";
import { getDoc } from "@react-native-firebase/firestore";
import Bugsnag from "@bugsnag/expo";

const mockUser = { uid: "user-123" };

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));

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
// Passthrough: the real one would keep a 15 s timer running for the
// never-settling getDoc above and hold the Jest worker open.
jest.mock("@/utils/withTimeout", () => ({
  withTimeout: (promise: Promise<unknown>) => promise,
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
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("falls back to Firestore when the cache isn't loaded and re-publishes a shared plan", async () => {
    (useSocialStore as unknown as jest.Mock).mockReturnValue({
      privacySettings: { sharePlans: false },
      publishedPlanIds: null,
    });
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true });

    const { result } = renderHook(() => useCreatePlan());

    act(() => {
      result.current.setPlanName("Push Day");
    });

    await act(async () => {
      await result.current.handleSavePlan(42, null);
    });

    expect(getDoc).toHaveBeenCalled();
    expect(publishPlan).toHaveBeenCalledWith("user-123", 42);
  });

  it("does not wait on the Firestore fallback when the cache isn't loaded", async () => {
    (useSocialStore as unknown as jest.Mock).mockReturnValue({
      privacySettings: { sharePlans: false },
      publishedPlanIds: null,
    });

    const { result } = renderHook(() => useCreatePlan());

    act(() => {
      result.current.setPlanName("Push Day");
    });

    // getDoc never resolves here; the save must still complete.
    await act(async () => {
      await result.current.handleSavePlan(42, null);
    });

    expect(result.current.planSaved).toBe(true);
    expect(publishPlan).not.toHaveBeenCalled();
  });
});

describe("useCreatePlan - schedule save", () => {
  const mockScheduleDb = (activePlanId: number | null) =>
    (openDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: jest.fn(() => Promise.resolve([{ id: 31 }, { id: 32 }])),
      getFirstAsync: jest.fn(() =>
        Promise.resolve(activePlanId === null ? null : { id: activePlanId }),
      ),
      closeAsync: jest.fn(() => Promise.resolve()),
    });

  const save = async (planSchedule: Record<number, number>) => {
    (useWorkoutStore as unknown as jest.Mock).mockReturnValue({
      workouts: [
        { id: 1, name: "Workout A" },
        { id: 2, name: "Workout B" },
      ],
      planImageUrl: null,
      setPlanImageUrl: jest.fn(),
      planSchedule,
      clearDraft: jest.fn(),
    });
    const { result } = renderHook(() => useCreatePlan());
    act(() => {
      result.current.setPlanName("Push Day");
    });
    await act(async () => {
      await result.current.handleSavePlan(42, null);
    });
    return result;
  };

  const invalidatedKeys = () =>
    mockInvalidateQueries.mock.calls.map(([arg]) => arg.queryKey);

  beforeEach(() => {
    jest.clearAllMocks();
    (useSocialStore as unknown as jest.Mock).mockReturnValue({
      privacySettings: { sharePlans: false },
      publishedPlanIds: [],
    });
    mockScheduleDb(null);
  });

  it("saves each day against the saved workout's id", async () => {
    await save({ 1: 0, 4: 1 });

    expect(savePlanSchedule).toHaveBeenCalledWith(42, [
      { day_of_week: 1, workout_id: 31 },
      { day_of_week: 4, workout_id: 32 },
    ]);
    expect(invalidatedKeys()).toContainEqual(["planSchedule", 42]);
  });

  it("drops a day whose workout was not saved", async () => {
    await save({ 1: 0, 4: 5 });

    expect(savePlanSchedule).toHaveBeenCalledWith(42, [
      { day_of_week: 1, workout_id: 31 },
    ]);
  });

  it("syncs the weekly goal when the plan is active", async () => {
    mockScheduleDb(42);

    await save({ 1: 0, 4: 1 });

    expect(updateSettings).toHaveBeenCalledWith("weeklyGoal", "2");
    expect(invalidatedKeys()).toContainEqual(["settings"]);
  });

  it("leaves the weekly goal alone for another plan", async () => {
    mockScheduleDb(7);

    await save({ 1: 0, 4: 1 });

    expect(updateSettings).not.toHaveBeenCalled();
    expect(invalidatedKeys()).not.toContainEqual(["settings"]);
  });

  it("clears the schedule when it is empty", async () => {
    await save({});

    expect(savePlanSchedule).toHaveBeenCalledWith(42, []);
  });

  it("reports a failed schedule save and still saves the plan", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("disk full");
    (savePlanSchedule as jest.Mock).mockRejectedValueOnce(error);

    const result = await save({ 1: 0 });

    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
    expect(result.current.planSaved).toBe(true);
  });
});
