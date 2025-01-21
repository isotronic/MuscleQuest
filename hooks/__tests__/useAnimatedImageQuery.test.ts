import {
  fetchAnimatedImageUrl,
  useAnimatedImageQuery,
} from "../useAnimatedImageQuery";
import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

// Mock your modules
jest.mock("@react-native-firebase/storage");
jest.mock("expo-file-system");
jest.mock("@/utils/database");
jest.mock("@tanstack/react-query");
jest.mock("@bugsnag/expo");

// Create mock objects for each mocked module
const mockStorage = {
  ref: jest.fn().mockReturnThis(),
  getDownloadURL: jest.fn(),
};
(storage as unknown as jest.Mock).mockImplementation(() => mockStorage);

const mockFileSystem = {
  createDownloadResumable: jest.fn(),
};
(FileSystem as any).createDownloadResumable =
  mockFileSystem.createDownloadResumable;

const mockInsertAnimatedImageUri = insertAnimatedImageUri as jest.Mock;

describe("useAnimatedImageQuery Tests", () => {
  //
  // 1) Override setTimeout so any "wait" is invoked immediately.
  //
  beforeAll(() => {
    jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
      // Immediately invoke the callback instead of waiting
      callback();
      // Return a mock timer id
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  //
  // 2) Restore the real setTimeout after all tests are done
  //
  afterAll(() => {
    jest.restoreAllMocks();
  });

  //
  // 3) If you still want to silence console errors in tests:
  //
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({
      downloadAsync: jest.fn(() => Promise.resolve({ uri: "/some/uri.webp" })),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // No need to useRealTimers(), we are manually mocking setTimeout above.
  });

  describe("fetchAnimatedImageUrl", () => {
    it("should return the local path if provided", async () => {
      const localPath = "file://local/path/to/image.webp";
      const result = await fetchAnimatedImageUrl(1, "path/to/image", localPath);
      expect(result).toBe(localPath);
    });

    it("should download the image and return the local path", async () => {
      const exerciseId = 1;
      const animatedUrlPath = "path/to/image";
      const localUri = `${FileSystem.documentDirectory}exercise_${exerciseId}.webp`;

      // Mock success behavior
      mockStorage.getDownloadURL.mockResolvedValueOnce(
        "https://example.com/image.webp",
      );
      mockFileSystem.createDownloadResumable.mockReturnValue({
        downloadAsync: jest.fn().mockResolvedValue({ uri: localUri }),
      });
      mockInsertAnimatedImageUri.mockResolvedValueOnce(undefined);

      // Call the function under test
      const result = await fetchAnimatedImageUrl(exerciseId, animatedUrlPath);

      // Assertions
      expect(result).toBe(localUri);
      expect(mockStorage.ref).toHaveBeenCalledWith(animatedUrlPath);
      expect(mockInsertAnimatedImageUri).toHaveBeenCalledWith(
        exerciseId,
        localUri,
      );
    });

    it("should retry on failure and notify Bugsnag if all retries fail", async () => {
      const exerciseId = 1;
      const animatedUrlPath = "path/to/image";
      const error = new Error("Download failed");

      // Mock failure every time, so it retries 3 times
      mockStorage.getDownloadURL.mockRejectedValue(error);

      // Call the function
      const fetchPromise = fetchAnimatedImageUrl(exerciseId, animatedUrlPath);

      // Since setTimeout is instant, it won't really wait (2s, 4s, 8s).
      // We can just await the promise and it should finish quickly.
      await expect(fetchPromise).rejects.toThrow("Download failed");

      // Ensure it retried 3 times
      expect(mockStorage.getDownloadURL).toHaveBeenCalledTimes(3);

      // Ensure Bugsnag was notified
      expect(Bugsnag.notify).toHaveBeenCalledWith(error);
    });
  });

  describe("useAnimatedImageQuery", () => {
    it("should call useQuery with correct arguments", () => {
      const mockUseQuery = jest.fn();
      (useQuery as jest.Mock).mockImplementation(mockUseQuery);

      const exerciseId = 1;
      const animatedUrlPath = "path/to/image";
      const localPath = "file://local/path/to/image.webp";

      // Call the hook
      useAnimatedImageQuery(exerciseId, animatedUrlPath, localPath);

      // Check that useQuery was invoked with the expected arguments
      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ["animatedImage", animatedUrlPath],
        queryFn: expect.any(Function),
        enabled: !!animatedUrlPath,
        staleTime: Infinity,
        cacheTime: 1000 * 60 * 60 * 24, // 24 hours
      });
    });
  });
});
