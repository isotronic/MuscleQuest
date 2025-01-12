import * as FileSystem from "expo-file-system";
import {
  fetchExercisesWithLocalAnimatedUri,
  clearAllLocalAnimatedUri,
} from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { deleteAllAnimatedImages } from "@/utils/deleteAllAnimatedImages";

describe("deleteAllAnimatedImages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete all images successfully and clear the database", async () => {
    const mockExercises = [
      { exercise_id: 1, local_animated_uri: "/path/to/image1.webp" },
      { exercise_id: 2, local_animated_uri: "/path/to/image2.webp" },
    ];
    (fetchExercisesWithLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(null);

    const onProgress = jest.fn();

    const result = await deleteAllAnimatedImages(onProgress);

    expect(fetchExercisesWithLocalAnimatedUri).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "/path/to/image1.webp",
      { idempotent: true },
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "/path/to/image2.webp",
      { idempotent: true },
    );
    expect(onProgress).toHaveBeenCalledWith(0.5); // After first file
    expect(onProgress).toHaveBeenCalledWith(1); // After second file
    expect(clearAllLocalAnimatedUri).toHaveBeenCalled();
    expect(result).toEqual({ success: true, failedDeletes: [] });
  });

  it("should handle partial deletion failures", async () => {
    const mockExercises = [
      { exercise_id: 1, local_animated_uri: "/path/to/image1.webp" },
      { exercise_id: 2, local_animated_uri: "/path/to/image2.webp" },
    ];
    (fetchExercisesWithLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );
    (FileSystem.deleteAsync as jest.Mock)
      .mockResolvedValueOnce(null) // First succeeds
      .mockRejectedValueOnce(new Error("Delete failed")); // Second fails

    const onProgress = jest.fn();

    const result = await deleteAllAnimatedImages(onProgress);

    expect(fetchExercisesWithLocalAnimatedUri).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(onProgress).toHaveBeenCalledWith(1);
    expect(clearAllLocalAnimatedUri).toHaveBeenCalled();
    expect(result).toEqual({ success: false, failedDeletes: [2] });
  });

  it("should do nothing if there are no exercises", async () => {
    (fetchExercisesWithLocalAnimatedUri as jest.Mock).mockResolvedValue([]);

    const onProgress = jest.fn();

    const result = await deleteAllAnimatedImages(onProgress);

    expect(fetchExercisesWithLocalAnimatedUri).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(clearAllLocalAnimatedUri).toHaveBeenCalled();
    expect(result).toEqual({ success: true, failedDeletes: [] });
  });

  it("should handle errors during database fetch", async () => {
    (fetchExercisesWithLocalAnimatedUri as jest.Mock).mockRejectedValue(
      new Error("Database fetch failed"),
    );

    const onProgress = jest.fn();

    await expect(deleteAllAnimatedImages(onProgress)).rejects.toThrow(
      "Database fetch failed",
    );

    expect(fetchExercisesWithLocalAnimatedUri).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
    expect(clearAllLocalAnimatedUri).not.toHaveBeenCalled();
  });
});
