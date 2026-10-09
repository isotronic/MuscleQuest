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
});
