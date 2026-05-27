import { useQuery } from "@tanstack/react-query";
import { fetchRecord, openDatabase } from "@/utils/database";
import { usePlanQuery } from "../usePlanQuery";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  fetchRecord: jest.fn(),
  openDatabase: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPlan = {
  id: 1,
  name: "Strength Plan",
  is_active: true,
};

const rawExerciseRow = {
  id: 10,
  plan_id: 1,
  name: "Chest Day",
  exercise_id: 101,
  exercise_name: "Bench Press",
  description: "Flat bench",
  image: null,
  local_animated_uri: "",
  animated_url: "",
  equipment: "barbell",
  body_part: "chest",
  target_muscle: "pectorals",
  secondary_muscles: '["triceps"]',
  tracking_type: "weight",
  sets: JSON.stringify([
    {
      repsMin: 5,
      repsMax: 5,
      restMinutes: 3,
      restSeconds: 0,
      time: 0,
      isWarmup: false,
      toFailure: false,
    },
  ]),
  exercise_order: 1,
  superset_group_id: null,
};

// ---------------------------------------------------------------------------
// usePlanQuery — configuration
// ---------------------------------------------------------------------------

describe("usePlanQuery — configuration", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: null, isLoading: false };
    });
  });

  it("is disabled when planId is null", () => {
    usePlanQuery(null);
    expect(capturedArgs.enabled).toBe(false);
  });

  it("is enabled when planId is provided", () => {
    usePlanQuery(1);
    expect(capturedArgs.enabled).toBe(true);
  });

  it("uses queryKey ['plan', planId]", () => {
    usePlanQuery(42);
    expect(capturedArgs.queryKey).toEqual(["plan", 42]);
  });
});

// ---------------------------------------------------------------------------
// usePlanQuery — queryFn (data transformation)
// ---------------------------------------------------------------------------

describe("usePlanQuery — queryFn", () => {
  let capturedArgs: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([rawExerciseRow]),
    };
    (openDatabase as jest.Mock).mockResolvedValue(mockDb);
    (fetchRecord as jest.Mock).mockResolvedValue(mockPlan);
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: null, isLoading: false };
    });
    usePlanQuery(1);
  });

  it("returns null when planData is not found", async () => {
    (fetchRecord as jest.Mock).mockResolvedValue(null);
    const result = await capturedArgs.queryFn();
    expect(result).toBeNull();
  });

  it("returns plan with parsed workouts on success", async () => {
    const result = await capturedArgs.queryFn();
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.workouts).toHaveLength(1);
  });

  it("groups multiple rows with the same workout id into one workout", async () => {
    const secondExerciseRow = {
      ...rawExerciseRow,
      exercise_id: 102,
      exercise_name: "Incline Press",
      exercise_order: 2,
    };
    mockDb.getAllAsync.mockResolvedValue([rawExerciseRow, secondExerciseRow]);
    const result = await capturedArgs.queryFn();
    expect(result!.workouts[0].exercises).toHaveLength(2);
  });

  it("skips rows where exercise_id is null", async () => {
    const noExerciseRow = {
      ...rawExerciseRow,
      exercise_id: null,
      exercise_name: null,
    };
    mockDb.getAllAsync.mockResolvedValue([noExerciseRow]);
    const result = await capturedArgs.queryFn();
    expect(result!.workouts[0].exercises).toHaveLength(0);
  });

  it("parses secondary_muscles JSON correctly", async () => {
    const result = await capturedArgs.queryFn();
    expect(result!.workouts[0].exercises[0].secondary_muscles).toEqual([
      "triceps",
    ]);
  });

  it("parses sets JSON correctly", async () => {
    const result = await capturedArgs.queryFn();
    const sets = result!.workouts[0].exercises[0].sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].repsMin).toBe(5);
  });

  it("maps superset_group_id to supersetGroupId", async () => {
    const supersetRow = { ...rawExerciseRow, superset_group_id: "group-A" };
    mockDb.getAllAsync.mockResolvedValue([supersetRow]);
    const result = await capturedArgs.queryFn();
    expect(result!.workouts[0].exercises[0].supersetGroupId).toBe("group-A");
  });

  it("returns null and notifies Bugsnag on DB error", async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error("DB crash"));
    const result = await capturedArgs.queryFn();
    expect(result).toBeNull();
    expect(Bugsnag.notify).toHaveBeenCalled();
  });
});
