import { useImportPlanMutation } from "../useImportPlanMutation";
import { useImportStandaloneWorkoutMutation } from "../useImportStandaloneWorkoutMutation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import { useSnackbarStore } from "@/store/snackbarStore";
import Bugsnag from "@bugsnag/expo";
import type { SharedExercise } from "@/types/firestore";

const mockTxnRunAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1 });
const mockWithTxn = jest.fn(async (cb: (txn: any) => Promise<void>) =>
  cb({ runAsync: mockTxnRunAsync }),
);

jest.mock("@/utils/database", () => ({ openDatabase: jest.fn() }));
jest.mock("@/utils/loadPremadePlans", () => ({
  ensureAppExercisesExist: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/utils/importUtils", () => ({
  ...jest.requireActual("@/utils/importUtils"),
  resolveExerciseId: jest.fn().mockResolvedValue(77),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const exercise = (overrides: Partial<SharedExercise> = {}): SharedExercise => ({
  appExerciseId: null,
  name: "Row",
  equipment: "",
  bodyPart: "",
  targetMuscle: "",
  secondaryMuscles: [],
  trackingType: "weight",
  isUnilateral: false,
  doubleWeight: false,
  animatedUrl: null,
  sets: [],
  exerciseOrder: 0,
  supersetGroupId: null,
  trackingTypeOverride: null,
  ...overrides,
});

let captured: any;
beforeEach(() => {
  jest.clearAllMocks();
  (openDatabase as jest.Mock).mockResolvedValue({
    withExclusiveTransactionAsync: mockWithTxn,
    closeAsync: jest.fn(),
  });
  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: jest.fn(),
  });
  (useMutation as jest.Mock).mockImplementation((args) => {
    captured = args;
    return {};
  });
  useSnackbarStore.setState({ current: null });
});

const exerciseInsert = () =>
  mockTxnRunAsync.mock.calls.find(([sql]) =>
    sql.includes("INSERT INTO user_workout_exercises"),
  )![1];

const hostile = exercise({
  sets: [{ repsMin: "8", repsMax: -1, injected: true }] as any,
  supersetGroupId: { evil: true } as any,
  trackingTypeOverride: "rocket",
});

describe("useImportPlanMutation", () => {
  const plan = (exercises: SharedExercise[]) =>
    ({
      name: "Shared",
      imageUrl: null,
      workouts: [{ name: "A", workoutOrder: 0, exercises }],
    }) as any;

  it("stores sanitised sets and drops invalid superset and override values", async () => {
    useImportPlanMutation();
    await captured.mutationFn(plan([hostile]));

    const [, , setsJson, , supersetGroupId, override] = exerciseInsert();
    expect(JSON.parse(setsJson)).toEqual([
      {
        repsMin: 8,
        restMinutes: 0,
        restSeconds: 0,
        isWarmup: false,
        isDropSet: false,
        isToFailure: false,
      },
    ]);
    expect(supersetGroupId).toBeNull();
    expect(override).toBeNull();
  });

  it("rejects an exercise with too many sets before writing anything", async () => {
    useImportPlanMutation();
    const huge = exercise({
      sets: Array.from({ length: 51 }, () => ({})) as any,
    });

    await expect(captured.mutationFn(plan([huge]))).rejects.toThrow();
    expect(mockWithTxn).not.toHaveBeenCalled();
  });

  it("tells the user why a malformed plan was not added", () => {
    const { ImportValidationError } = jest.requireActual("@/utils/importUtils");
    useImportPlanMutation();

    captured.onError(new ImportValidationError("too many sets"));

    expect(useSnackbarStore.getState().current?.message).toBeTruthy();
    expect(Bugsnag.notify).not.toHaveBeenCalled();
  });
});

describe("useImportPlanMutation with a malformed structure", () => {
  it.each([
    ["workouts that are not a list", { name: "x", workouts: "nope" }],
    [
      "exercises that are not a list",
      { name: "x", workouts: [{ name: "A", exercises: null }] },
    ],
    ["a workout that is not an object", { name: "x", workouts: [42] }],
    [
      "an exercise that is not an object",
      { name: "x", workouts: [{ name: "A", exercises: ["nope"] }] },
    ],
  ])("rejects %s with a validation error", async (_label, plan) => {
    const { ImportValidationError } = jest.requireActual("@/utils/importUtils");
    useImportPlanMutation();

    await expect(captured.mutationFn(plan)).rejects.toBeInstanceOf(
      ImportValidationError,
    );
    expect(openDatabase).not.toHaveBeenCalled();
  });
});

describe("exercise fields stored for a new custom exercise", () => {
  it.each([
    ["a name that is not a string", { name: { evil: true } }],
    ["an empty name", { name: "" }],
    ["a library id that is not an integer", { appExerciseId: "12" }],
    ["a negative library id", { appExerciseId: -3 }],
    ["a body part that is not a string", { bodyPart: 7 }],
    ["a target muscle that is not a string", { targetMuscle: null }],
    ["equipment that is not a string", { equipment: ["bar"] }],
    ["secondary muscles that are not a list", { secondaryMuscles: "abs" }],
    ["secondary muscles that are not strings", { secondaryMuscles: [1] }],
    ["a unilateral flag that is not a boolean", { isUnilateral: "yes" }],
    ["a double-weight flag that is not a boolean", { doubleWeight: 1 }],
    ["an animation url that is not a string", { animatedUrl: 5 }],
  ])("rejects %s before writing anything", async (_label, overrides) => {
    const { ImportValidationError } = jest.requireActual("@/utils/importUtils");
    useImportStandaloneWorkoutMutation();

    await expect(
      captured.mutationFn({
        name: "x",
        exercises: [exercise(overrides as any)],
      }),
    ).rejects.toBeInstanceOf(ImportValidationError);
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it("accepts a library exercise and a null animation url", async () => {
    useImportStandaloneWorkoutMutation();

    await expect(
      captured.mutationFn({
        name: "x",
        exercises: [exercise({ appExerciseId: 12, animatedUrl: null })],
      }),
    ).resolves.toBeDefined();
  });
});

describe("useImportStandaloneWorkoutMutation", () => {
  const workout = (exercises: SharedExercise[]) =>
    ({ name: "Shared", imageUrl: null, exercises }) as any;

  it("stores sanitised sets", async () => {
    useImportStandaloneWorkoutMutation();
    await captured.mutationFn(workout([hostile]));

    const [, , setsJson, , supersetGroupId, override] = exerciseInsert();
    expect(JSON.parse(setsJson)[0]).not.toHaveProperty("injected");
    expect(supersetGroupId).toBeNull();
    expect(override).toBeNull();
  });

  it("rejects a sets value that is not a list before writing anything", async () => {
    useImportStandaloneWorkoutMutation();

    await expect(
      captured.mutationFn(workout([exercise({ sets: "x" as any })])),
    ).rejects.toThrow();
    expect(mockWithTxn).not.toHaveBeenCalled();
  });

  it("tells the user why a malformed workout was not added", () => {
    const { ImportValidationError } = jest.requireActual("@/utils/importUtils");
    useImportStandaloneWorkoutMutation();

    captured.onError(new ImportValidationError("not a list"));

    expect(useSnackbarStore.getState().current?.message).toBeTruthy();
  });

  it("rejects exercises that are not a list with a validation error", async () => {
    const { ImportValidationError } = jest.requireActual("@/utils/importUtils");
    useImportStandaloneWorkoutMutation();

    await expect(
      captured.mutationFn({ name: "x", exercises: { 0: {} } }),
    ).rejects.toBeInstanceOf(ImportValidationError);
    expect(openDatabase).not.toHaveBeenCalled();
  });
});
