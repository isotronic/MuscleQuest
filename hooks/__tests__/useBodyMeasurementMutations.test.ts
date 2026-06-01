import {
  useInsertBodyMeasurementMutation,
  useDeleteBodyMeasurementMutation,
} from "../useBodyMeasurementMutations";
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
  useSocialStore: jest.fn(() => ({ privacySettings: null })),
}));
jest.mock("@/utils/sharing", () => ({
  pushBodyMeasurement: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/database", () => ({
  insertBodyMeasurementSession: jest.fn(),
  updateBodyMeasurementSession: jest.fn(),
  deleteBodyMeasurementSession: jest.fn(),
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
