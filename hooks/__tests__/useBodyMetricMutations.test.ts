import {
  useToggleBodyMetricActiveMutation,
  useInsertCustomBodyMetricMutation,
  useSoftDeleteCustomBodyMetricMutation,
} from "../useBodyMetricMutations";
import {
  toggleBodyMetricActive,
  insertCustomBodyMetricDefinition,
  softDeleteCustomBodyMetricDefinition,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  toggleBodyMetricActive: jest.fn(),
  insertCustomBodyMetricDefinition: jest.fn(),
  softDeleteCustomBodyMetricDefinition: jest.fn(),
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

const setupMock = () => {
  let capturedArgs: any;
  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });
  (useMutation as jest.Mock).mockImplementation((args: any) => {
    capturedArgs = args;
    return { mutate: jest.fn() };
  });
  return () => capturedArgs;
};

describe("useToggleBodyMetricActiveMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (toggleBodyMetricActive as jest.Mock).mockResolvedValue(undefined);
    setupMock();
  });

  it("mutationFn calls toggleBodyMetricActive with id and is_active", async () => {
    let capturedArgs: any;
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });

    useToggleBodyMetricActiveMutation();

    await capturedArgs.mutationFn({ id: 3, is_active: true });

    expect(toggleBodyMetricActive).toHaveBeenCalledWith(3, true);
  });

  it("onSuccess invalidates bodyMetricDefinitions", () => {
    let capturedArgs: any;
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });

    useToggleBodyMetricActiveMutation();
    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMetricDefinitions"],
    });
  });
});

describe("useInsertCustomBodyMetricMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (insertCustomBodyMetricDefinition as jest.Mock).mockResolvedValue(1);
    setupMock();
  });

  it("mutationFn calls insertCustomBodyMetricDefinition with label and value_kind", async () => {
    let capturedArgs: any;
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });

    useInsertCustomBodyMetricMutation();

    await capturedArgs.mutationFn({ label: "Chest", value_kind: "length" });

    expect(insertCustomBodyMetricDefinition).toHaveBeenCalledWith(
      "Chest",
      "length",
    );
  });

  it("onSuccess invalidates bodyMetricDefinitions", () => {
    let capturedArgs: any;
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });

    useInsertCustomBodyMetricMutation();
    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMetricDefinitions"],
    });
  });
});

describe("useSoftDeleteCustomBodyMetricMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (softDeleteCustomBodyMetricDefinition as jest.Mock).mockResolvedValue(
      undefined,
    );
    setupMock();
  });

  it("mutationFn calls softDeleteCustomBodyMetricDefinition with id", async () => {
    let capturedArgs: any;
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });

    useSoftDeleteCustomBodyMetricMutation();

    await capturedArgs.mutationFn(7);

    expect(softDeleteCustomBodyMetricDefinition).toHaveBeenCalledWith(7);
  });

  it("onSuccess invalidates bodyMetricDefinitions and bodyMeasurements", () => {
    let capturedArgs: any;
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });

    useSoftDeleteCustomBodyMetricMutation();
    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMetricDefinitions"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMeasurements"],
    });
  });
});
