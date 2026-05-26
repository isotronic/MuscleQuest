import { useToggleFavoriteExerciseMutation } from "../useToggleFavoriteExerciseMutation";
import { openDatabase } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(() => Promise.resolve({ runAsync: mockRunAsync })),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

describe("useToggleFavoriteExerciseMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue(undefined);
    (openDatabase as jest.Mock).mockResolvedValue({ runAsync: mockRunAsync });
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls db.runAsync to toggle favorite", async () => {
    useToggleFavoriteExerciseMutation();

    await capturedArgs.mutationFn({ exerciseId: 42, currentStatus: 0 });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE exercises"),
    );
  });

  it("mutationFn sets favorite to 1 when currentStatus is 0", async () => {
    useToggleFavoriteExerciseMutation();

    await capturedArgs.mutationFn({ exerciseId: 42, currentStatus: 0 });

    const sql = mockRunAsync.mock.calls[0][0];
    expect(sql).toContain("favorite = 1");
    expect(sql).toContain("WHERE exercise_id = 42");
  });

  it("mutationFn sets favorite to 0 when currentStatus is 1", async () => {
    useToggleFavoriteExerciseMutation();

    await capturedArgs.mutationFn({ exerciseId: 42, currentStatus: 1 });

    const sql = mockRunAsync.mock.calls[0][0];
    expect(sql).toContain("favorite = 0");
    expect(sql).toContain("WHERE exercise_id = 42");
  });

  it("onSuccess invalidates ['exercises'] and ['exercise-info', exerciseId]", () => {
    useToggleFavoriteExerciseMutation();

    capturedArgs.onSuccess(undefined, { exerciseId: 42, currentStatus: 0 });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["exercises"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["exercise-info", 42],
    });
  });
});
