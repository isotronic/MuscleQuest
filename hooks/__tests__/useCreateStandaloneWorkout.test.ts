import {
  useCreateStandaloneWorkout,
  useUpdateStandaloneWorkout,
  useDeleteStandaloneWorkout,
} from "../useCreateStandaloneWorkout";
import {
  createStandaloneWorkout,
  updateStandaloneWorkout,
  deleteStandaloneWorkout,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  createStandaloneWorkout: jest.fn(),
  updateStandaloneWorkout: jest.fn(),
  deleteStandaloneWorkout: jest.fn(),
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

function setupMocks() {
  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });
}

// ---------------------------------------------------------------------------
// useCreateStandaloneWorkout
// ---------------------------------------------------------------------------

describe("useCreateStandaloneWorkout", () => {
  let capturedArgs: any;

  beforeEach(() => {
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls createStandaloneWorkout with name and exercises", async () => {
    (createStandaloneWorkout as jest.Mock).mockResolvedValue(1);
    useCreateStandaloneWorkout();

    const exercises: any[] = [];
    await capturedArgs.mutationFn({ name: "Quick Session", exercises });

    expect(createStandaloneWorkout).toHaveBeenCalledWith(
      "Quick Session",
      exercises,
    );
  });

  it("onSuccess invalidates ['standaloneWorkouts']", () => {
    useCreateStandaloneWorkout();
    capturedArgs.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["standaloneWorkouts"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useCreateStandaloneWorkout();
    const error = new Error("create failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// useUpdateStandaloneWorkout
// ---------------------------------------------------------------------------

describe("useUpdateStandaloneWorkout", () => {
  let capturedArgs: any;

  beforeEach(() => {
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls updateStandaloneWorkout with workoutId, name, and exercises", async () => {
    (updateStandaloneWorkout as jest.Mock).mockResolvedValue(undefined);
    useUpdateStandaloneWorkout();

    const exercises: any[] = [];
    await capturedArgs.mutationFn({
      workoutId: 42,
      name: "Updated",
      exercises,
    });

    expect(updateStandaloneWorkout).toHaveBeenCalledWith(
      42,
      "Updated",
      exercises,
    );
  });

  it("onSuccess invalidates ['standaloneWorkouts']", () => {
    useUpdateStandaloneWorkout();
    capturedArgs.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["standaloneWorkouts"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useUpdateStandaloneWorkout();
    const error = new Error("update failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// useDeleteStandaloneWorkout
// ---------------------------------------------------------------------------

describe("useDeleteStandaloneWorkout", () => {
  let capturedArgs: any;

  beforeEach(() => {
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls deleteStandaloneWorkout with workoutId", async () => {
    (deleteStandaloneWorkout as jest.Mock).mockResolvedValue(undefined);
    useDeleteStandaloneWorkout();

    await capturedArgs.mutationFn(99);

    expect(deleteStandaloneWorkout).toHaveBeenCalledWith(99);
  });

  it("onSuccess invalidates ['standaloneWorkouts']", () => {
    useDeleteStandaloneWorkout();
    capturedArgs.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["standaloneWorkouts"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useDeleteStandaloneWorkout();
    const error = new Error("delete failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
