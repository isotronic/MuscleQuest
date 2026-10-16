import {
  exerciseImageFilesInFlight,
  startExerciseImageFiles,
} from "../exerciseImageFilesRun";
import { writeExerciseImageFiles } from "@/utils/db/exerciseImageFiles";

jest.mock("@/utils/db/exerciseImageFiles", () => ({
  writeExerciseImageFiles: jest.fn(),
}));

const mockWrite = writeExerciseImageFiles as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("startExerciseImageFiles", () => {
  it("joins a run in progress instead of starting a second", async () => {
    let finish: (v: { written: number; failed: number }) => void = () => {};
    mockWrite.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = startExerciseImageFiles();
    const second = startExerciseImageFiles();

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(exerciseImageFilesInFlight()).toBe(first);
    finish({ written: 1, failed: 0 });
    await expect(second).resolves.toEqual({ written: 1, failed: 0 });
  });

  it("starts a new run once the last one settled", async () => {
    mockWrite.mockResolvedValue({ written: 0, failed: 0 });

    await startExerciseImageFiles();
    expect(exerciseImageFilesInFlight()).toBeNull();
    await startExerciseImageFiles();

    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it("clears the run after a failure", async () => {
    mockWrite.mockRejectedValueOnce(new Error("disk full"));

    await expect(startExerciseImageFiles()).rejects.toThrow("disk full");
    expect(exerciseImageFilesInFlight()).toBeNull();
  });
});
