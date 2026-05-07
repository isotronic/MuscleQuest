import { File } from "expo-file-system";
import {
  fetchExercisesWithLocalAnimatedUri,
  clearAllLocalAnimatedUri,
} from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { deleteAllAnimatedImages } from "@/utils/deleteAllAnimatedImages";

describe("deleteAllAnimatedImages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (File as unknown as jest.Mock).mockImplementation(() => ({
      exists: true,
      delete: jest.fn(),
    }));
  });

  it("should delete all images successfully and clear the database", async () => {
    const mockExercises = [
      { exercise_id: 1, local_animated_uri: "/path/to/image1.webp" },
      { exercise_id: 2, local_animated_uri: "/path/to/image2.webp" },
    ];
    (fetchExercisesWithLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    const onProgress = jest.fn();

    const result = await deleteAllAnimatedImages(onProgress);

    expect(fetchExercisesWithLocalAnimatedUri).toHaveBeenCalled();
    expect(File).toHaveBeenCalledTimes(2);
    expect(File).toHaveBeenCalledWith("/path/to/image1.webp");
    expect(File).toHaveBeenCalledWith("/path/to/image2.webp");
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(onProgress).toHaveBeenCalledWith(1);
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

    const mockDelete = jest.fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("Delete failed");
      });
    (File as unknown as jest.Mock).mockImplementation(() => ({
      exists: true,
      delete: mockDelete,
    }));

    const onProgress = jest.fn();

    const result = await deleteAllAnimatedImages(onProgress);

    expect(fetchExercisesWithLocalAnimatedUri).toHaveBeenCalled();
    expect(File).toHaveBeenCalledTimes(2);
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
    expect(File).not.toHaveBeenCalled();
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
    expect(File).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
    expect(clearAllLocalAnimatedUri).not.toHaveBeenCalled();
  });
});
