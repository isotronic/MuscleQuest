import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import {
  fetchExercisesWithoutLocalAnimatedUri,
  insertAnimatedImageUri,
} from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { downloadAllAnimatedImages } from "@/utils/downloadAllAnimatedImages";

jest.mock("expo-file-system");
jest.mock("@react-native-firebase/storage");
jest.mock("@/utils/database");
jest.mock("@bugsnag/expo");

describe("downloadAllAnimatedImages", () => {
  jest.setTimeout(10000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should download all images successfully and update progress", async () => {
    const mockExercises = [
      { exercise_id: 1, animated_url: "path/to/image1" },
      { exercise_id: 2, animated_url: "path/to/image2" },
    ];

    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    (storage().ref as jest.Mock).mockImplementation((url) => ({
      getDownloadURL: jest.fn().mockResolvedValueOnce(`mockDownloadUrl_${url}`),
    }));

    (FileSystem.createDownloadResumable as jest.Mock).mockImplementation(
      (url) => ({
        downloadAsync: jest.fn().mockResolvedValue(null),
      }),
    );

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(storage().ref).toHaveBeenCalledTimes(mockExercises.length); // Match exact length
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledTimes(
      mockExercises.length,
    );
    expect(insertAnimatedImageUri).toHaveBeenCalledWith(1, expect.any(String));
    expect(insertAnimatedImageUri).toHaveBeenCalledWith(2, expect.any(String));
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(onProgress).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true, failedDownloads: [] });
  });

  it("should handle partial download failures", async () => {
    const mockExercises = [
      { exercise_id: 1, animated_url: "path/to/image1" },
      { exercise_id: 2, animated_url: "path/to/image2" },
    ];

    // Mock fetch function
    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    // Track calls for retries
    const mockCalls: Record<string, number> = {
      "path/to/image1": 0,
      "path/to/image2": 0,
    };

    // Mock Firebase storage ref
    const storageMock = (storage().ref as jest.Mock).mockImplementation(
      (url) => {
        mockCalls[url]++;
        if (url === "path/to/image1") {
          return {
            getDownloadURL: jest.fn().mockResolvedValue("mockDownloadUrl1"),
          };
        }
        if (url === "path/to/image2") {
          return {
            getDownloadURL: jest
              .fn()
              .mockRejectedValue(new Error("Download failed")), // Simulate failure
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    );

    // Mock FileSystem download resumable
    (FileSystem.createDownloadResumable as jest.Mock).mockImplementation(
      (url) => {
        if (url === "mockDownloadUrl1") {
          return {
            downloadAsync: jest.fn().mockResolvedValue(null),
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    );

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    // Assertions
    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalledTimes(1);
    expect(storageMock).toHaveBeenCalledTimes(
      mockExercises.length + 2, // +2 for the retries of exercise 2
    );
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledTimes(1); // One success
    expect(insertAnimatedImageUri).toHaveBeenCalledWith(1, expect.any(String));
    expect(Bugsnag.notify).toHaveBeenCalledTimes(1); // One failure
    expect(Bugsnag.notify).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Download failed" }),
    );
    expect(result).toEqual({ success: false, failedDownloads: [2] });

    // Verify retries
    expect(mockCalls["path/to/image1"]).toBe(1); // Single success
    expect(mockCalls["path/to/image2"]).toBe(3); // Three retries
  });

  it("should resolve immediately if there are no exercises", async () => {
    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue([]);

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(storage().ref).not.toHaveBeenCalled();
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, failedDownloads: [] });
  });

  it("should handle database fetch errors", async () => {
    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockRejectedValue(
      new Error("Database fetch failed"),
    );

    const onProgress = jest.fn();

    await expect(downloadAllAnimatedImages(onProgress)).rejects.toThrow(
      "Database fetch failed",
    );

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(storage().ref).not.toHaveBeenCalled();
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should retry failed downloads before giving up", async () => {
    const mockExercises = [{ exercise_id: 1, animated_url: "path/to/image1" }];

    // Mock the fetch function
    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    // Mock Firebase storage ref
    let retryCount = 0;
    (storage().ref as jest.Mock).mockImplementation((url) => {
      if (url === "path/to/image1") {
        return {
          getDownloadURL: jest.fn().mockImplementation(() => {
            retryCount++;
            if (retryCount < 3) {
              // Fail first 2 retries
              return Promise.reject(new Error("Temporary failure"));
            }
            // Succeed on third attempt
            return Promise.resolve("mockDownloadUrl1");
          }),
        };
      }
      throw new Error("Unexpected URL");
    });

    // Mock FileSystem download resumable
    (FileSystem.createDownloadResumable as jest.Mock).mockImplementation(
      (url) => {
        if (url === "mockDownloadUrl1") {
          return {
            downloadAsync: jest.fn().mockResolvedValue(null),
          };
        }
        throw new Error("Unexpected URL");
      },
    );

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    // Assertions
    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(storage().ref).toHaveBeenCalledTimes(3); // 3 retries for exercise 1
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledTimes(1);
    expect(insertAnimatedImageUri).toHaveBeenCalledWith(1, expect.any(String));
    expect(Bugsnag.notify).not.toHaveBeenCalled(); // No failures
    expect(result).toEqual({ success: true, failedDownloads: [] });
  });
});
