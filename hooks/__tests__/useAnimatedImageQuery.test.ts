import {
  fetchAnimatedImageUrl,
  shouldRetryAnimatedImage,
  useAnimatedImageQuery,
} from "../useAnimatedImageQuery";
import { ref, getDownloadURL } from "@react-native-firebase/storage";
import { File } from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { wasReported } from "@/utils/bugsnagDedup";

jest.mock("@react-native-firebase/storage");
jest.mock("@/utils/database");
jest.mock("@tanstack/react-query");
jest.mock("@bugsnag/expo");

const mockInsertAnimatedImageUri = insertAnimatedImageUri as jest.Mock;

describe("useAnimatedImageQuery Tests", () => {
  beforeAll(() => {
    jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (File as any).downloadFileAsync = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      const mockRef = { _url: animatedUrlPath };
      (ref as jest.Mock).mockReturnValue(mockRef);
      (getDownloadURL as jest.Mock).mockResolvedValueOnce(
        "https://example.com/image.webp",
      );
      mockInsertAnimatedImageUri.mockResolvedValueOnce(undefined);

      const result = await fetchAnimatedImageUrl(exerciseId, animatedUrlPath);

      expect((File as any).downloadFileAsync).toHaveBeenCalledWith(
        "https://example.com/image.webp",
        expect.anything(),
        { idempotent: true },
      );
      expect(mockInsertAnimatedImageUri).toHaveBeenCalledWith(
        exerciseId,
        expect.any(String),
      );
      expect(result).toEqual(expect.any(String));
      expect(ref).toHaveBeenCalledWith(expect.anything(), animatedUrlPath);
    });

    it("should retry on failure and notify Bugsnag if all retries fail", async () => {
      const exerciseId = 1;
      const animatedUrlPath = "path/to/image";
      const error = new Error("Download failed");

      (ref as jest.Mock).mockReturnValue({ _url: animatedUrlPath });
      (getDownloadURL as jest.Mock).mockRejectedValue(error);

      const fetchPromise = fetchAnimatedImageUrl(exerciseId, animatedUrlPath);

      await expect(fetchPromise).rejects.toThrow("Download failed");

      expect(getDownloadURL).toHaveBeenCalledTimes(3);
      expect(Bugsnag.notify).toHaveBeenCalledWith(error);
    });

    it("gives up at once on storage/unauthorized and keeps it out of Bugsnag", async () => {
      const error = Object.assign(new Error("not authorized"), {
        code: "storage/unauthorized",
      });
      (ref as jest.Mock).mockReturnValue({});
      (getDownloadURL as jest.Mock).mockRejectedValue(error);

      await expect(fetchAnimatedImageUrl(1, "path/to/image")).rejects.toBe(
        error,
      );

      expect(getDownloadURL).toHaveBeenCalledTimes(1);
      expect(Bugsnag.notify).not.toHaveBeenCalled();
      // The global query net skips it too.
      expect(wasReported(error)).toBe(true);
    });

    it("reports a missing file once without retrying", async () => {
      const error = Object.assign(new Error("not found"), {
        code: "storage/object-not-found",
      });
      (ref as jest.Mock).mockReturnValue({});
      (getDownloadURL as jest.Mock).mockRejectedValue(error);

      await expect(fetchAnimatedImageUrl(1, "path/to/image")).rejects.toBe(
        error,
      );

      expect(getDownloadURL).toHaveBeenCalledTimes(1);
      expect(Bugsnag.notify).toHaveBeenCalledWith(error);
    });
  });

  describe("shouldRetryAnimatedImage", () => {
    it("never retries a permanent storage error", () => {
      expect(
        shouldRetryAnimatedImage(0, { code: "storage/unauthorized" } as any),
      ).toBe(false);
      expect(
        shouldRetryAnimatedImage(0, {
          code: "storage/object-not-found",
        } as any),
      ).toBe(false);
    });

    it("retries other errors up to three times", () => {
      const error = new Error("network");
      expect(shouldRetryAnimatedImage(2, error)).toBe(true);
      expect(shouldRetryAnimatedImage(3, error)).toBe(false);
    });
  });

  describe("useAnimatedImageQuery", () => {
    it("should call useQuery with correct arguments", () => {
      const mockUseQuery = jest.fn();
      (useQuery as jest.Mock).mockImplementation(mockUseQuery);

      const exerciseId = 1;
      const animatedUrlPath = "path/to/image";
      const localPath = "file://local/path/to/image.webp";

      useAnimatedImageQuery(exerciseId, animatedUrlPath, localPath);

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ["animatedImage", animatedUrlPath],
        queryFn: expect.any(Function),
        enabled: !!animatedUrlPath,
        retry: shouldRetryAnimatedImage,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60,
      });
    });
  });
});
