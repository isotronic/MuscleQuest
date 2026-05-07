import { ref, getDownloadURL } from "@react-native-firebase/storage";
import { File } from "expo-file-system";
import {
  fetchExercisesWithoutLocalAnimatedUri,
  insertAnimatedImageUris,
} from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { downloadAllAnimatedImages } from "@/utils/downloadAllAnimatedImages";

jest.mock("@react-native-firebase/storage");
jest.mock("@/utils/database");
jest.mock("@bugsnag/expo");

describe("downloadAllAnimatedImages", () => {
  jest.setTimeout(10000);

  beforeEach(() => {
    jest.clearAllMocks();
    (File as any).downloadFileAsync = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  it("should download all images successfully and update progress", async () => {
    const mockExercises = [
      { exercise_id: 1, animated_url: "path/to/image1" },
      { exercise_id: 2, animated_url: "path/to/image2" },
    ];

    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    (ref as jest.Mock).mockImplementation((_storage, url) => ({ _url: url }));
    (getDownloadURL as jest.Mock).mockImplementation((refObj) =>
      Promise.resolve(`mockDownloadUrl_${refObj._url}`),
    );

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(ref).toHaveBeenCalledTimes(mockExercises.length);
    expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(
      mockExercises.length,
    );
    expect(insertAnimatedImageUris).toHaveBeenCalledWith([
      { exercise_id: 1, local_animated_uri: expect.any(String) },
      { exercise_id: 2, local_animated_uri: expect.any(String) },
    ]);
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(onProgress).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true, failedDownloads: [] });
  });

  it("should handle partial download failures", async () => {
    const mockExercises = [
      { exercise_id: 1, animated_url: "path/to/image1" },
      { exercise_id: 2, animated_url: "path/to/image2" },
    ];

    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    (ref as jest.Mock).mockImplementation((_storage, url) => ({ _url: url }));

    const getDownloadURLMock = (getDownloadURL as jest.Mock).mockImplementation(
      (refObj) => {
        if (refObj._url === "path/to/image1") {
          return Promise.resolve("mockDownloadUrl1");
        }
        return Promise.reject(new Error("Download failed"));
      },
    );

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledTimes(mockExercises.length);
    // getDownloadURL: 1 for exercise 1 + 3 attempts for exercise 2
    expect(getDownloadURLMock).toHaveBeenCalledTimes(mockExercises.length + 2);
    expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(1);
    expect(insertAnimatedImageUris).toHaveBeenCalledWith([
      { exercise_id: 1, local_animated_uri: expect.any(String) },
    ]);
    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: false, failedDownloads: [2] });
  });

  it("should resolve immediately if there are no exercises", async () => {
    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue([]);

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(ref).not.toHaveBeenCalled();
    expect((File as any).downloadFileAsync).not.toHaveBeenCalled();
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
    expect(ref).not.toHaveBeenCalled();
    expect((File as any).downloadFileAsync).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should retry failed downloads before giving up", async () => {
    const mockExercises = [{ exercise_id: 1, animated_url: "path/to/image1" }];

    (fetchExercisesWithoutLocalAnimatedUri as jest.Mock).mockResolvedValue(
      mockExercises,
    );

    (ref as jest.Mock).mockImplementation((_storage, url) => ({ _url: url }));

    let retryCount = 0;
    const getDownloadURLMock = (getDownloadURL as jest.Mock).mockImplementation(
      () => {
        retryCount++;
        if (retryCount < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve("mockDownloadUrl1");
      },
    );

    const onProgress = jest.fn();

    const result = await downloadAllAnimatedImages(onProgress);

    expect(fetchExercisesWithoutLocalAnimatedUri).toHaveBeenCalled();
    expect(ref).toHaveBeenCalledTimes(1);
    expect(getDownloadURLMock).toHaveBeenCalledTimes(3);
    expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(1);
    expect(insertAnimatedImageUris).toHaveBeenCalledWith([
      { exercise_id: 1, local_animated_uri: expect.any(String) },
    ]);
    expect(Bugsnag.notify).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, failedDownloads: [] });
  });
});
