import {
  useInsertBodyMeasurementMutation,
  useDeleteBodyMeasurementMutation,
  useDeleteBodyMeasurementWithUndo,
} from "../useBodyMeasurementMutations";
import { useSnackbarStore } from "@/store/snackbarStore";
import { usePendingDeleteStore } from "@/store/pendingDeleteStore";
import {
  insertBodyMeasurementSession,
  deleteBodyMeasurementSession,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(null),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@react-native-firebase/firestore", () => {
  const mockFirestore: any = jest.fn(() => ({ collection: jest.fn() }));
  mockFirestore.FieldValue = { serverTimestamp: jest.fn() };
  mockFirestore.Timestamp = {
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  };
  return mockFirestore;
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({
    privacySettings: null,
    publishedPlanIds: null,
    publishedWorkoutIds: null,
  })),
}));
jest.mock("@/utils/sharing", () => ({
  pushBodyMeasurement: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/database", () => ({
  insertBodyMeasurementSession: jest.fn(),
  updateBodyMeasurementSession: jest.fn(),
  deleteBodyMeasurementSession: jest.fn(),
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

const mockInvalidateQueries = jest.fn();
const OPTIONS = { weightUnit: "kg" as const, sizeUnit: "cm" as const };

describe("useInsertBodyMeasurementMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    (insertBodyMeasurementSession as jest.Mock).mockResolvedValue(1);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    (insertBodyMeasurementSession as jest.Mock).mockResolvedValue(1);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn passes canonical kg values when unit is kg", async () => {
    useInsertBodyMeasurementMutation(OPTIONS);

    await capturedArgs.mutationFn({
      recorded_at: "2026-01-01",
      values: [{ metric_id: 1, value_kind: "mass", displayValue: 75 }],
    });

    // For kg, canonical value = display value
    expect(insertBodyMeasurementSession).toHaveBeenCalledWith("2026-01-01", [
      { metric_id: 1, value: 75 },
    ]);
  });

  it("mutationFn converts lbs to kg for canonical storage", async () => {
    const lbsOptions = { weightUnit: "lbs" as const, sizeUnit: "cm" as const };
    useInsertBodyMeasurementMutation(lbsOptions);

    await capturedArgs.mutationFn({
      recorded_at: "2026-01-01",
      values: [{ metric_id: 1, value_kind: "mass", displayValue: 220.5 }],
    });

    expect(insertBodyMeasurementSession).toHaveBeenCalledWith(
      "2026-01-01",
      expect.arrayContaining([
        expect.objectContaining({
          metric_id: 1,
          value: expect.closeTo(100, 0), // ~100 kg
        }),
      ]),
    );
  });

  it("mutationFn filters out NaN values", async () => {
    useInsertBodyMeasurementMutation(OPTIONS);

    await capturedArgs.mutationFn({
      recorded_at: "2026-01-01",
      values: [
        { metric_id: 1, value_kind: "mass", displayValue: 75 },
        { metric_id: 2, value_kind: "length", displayValue: NaN },
      ],
    });

    expect(insertBodyMeasurementSession).toHaveBeenCalledWith(
      "2026-01-01",
      [{ metric_id: 1, value: 75 }], // Only the valid one
    );
  });

  it("onSuccess invalidates bodyMeasurements and settings", () => {
    useInsertBodyMeasurementMutation(OPTIONS);

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMeasurements"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settings"],
    });
  });
});

describe("useDeleteBodyMeasurementMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    (deleteBodyMeasurementSession as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    (deleteBodyMeasurementSession as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls deleteBodyMeasurementSession with entry_id", async () => {
    useDeleteBodyMeasurementMutation();

    await capturedArgs.mutationFn(99);

    expect(deleteBodyMeasurementSession).toHaveBeenCalledWith(99);
  });

  it("onSuccess invalidates bodyMeasurements", () => {
    useDeleteBodyMeasurementMutation();

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMeasurements"],
    });
  });
});

describe("useDeleteBodyMeasurementWithUndo", () => {
  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(() => {
    jest.clearAllMocks();
    (deleteBodyMeasurementSession as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    usePendingDeleteStore.setState({ measurementEntryIds: [] });
    useSnackbarStore.setState({ current: null });
  });

  it("hides the entry at once but does not delete it yet", () => {
    useDeleteBodyMeasurementWithUndo()(5);

    expect(usePendingDeleteStore.getState().measurementEntryIds).toEqual([5]);
    expect(deleteBodyMeasurementSession).not.toHaveBeenCalled();
    expect(useSnackbarStore.getState().current?.action?.label).toBe("Undo");
  });

  it("does not delete when Undo is pressed", async () => {
    useDeleteBodyMeasurementWithUndo()(5);

    useSnackbarStore.getState().pressAction();
    await flush();

    expect(deleteBodyMeasurementSession).not.toHaveBeenCalled();
    expect(usePendingDeleteStore.getState().measurementEntryIds).toEqual([]);
  });

  it("deletes once the snackbar closes without Undo", async () => {
    useDeleteBodyMeasurementWithUndo()(5);

    useSnackbarStore.getState().dismiss();
    await flush();

    expect(deleteBodyMeasurementSession).toHaveBeenCalledWith(5);
    expect(usePendingDeleteStore.getState().measurementEntryIds).toEqual([]);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMeasurements"],
    });
  });
});
