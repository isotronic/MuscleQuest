import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "../asyncStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("asyncStorage utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mock calls and instances before each test
  });

  describe("getAsyncStorageItem", () => {
    it("should return the stored value for the given key", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("testValue");

      const result = await getAsyncStorageItem("testKey");
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("testKey");
      expect(result).toBe("testValue");
    });

    it("should return an empty string if the key does not exist", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getAsyncStorageItem("nonExistentKey");
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("nonExistentKey");
      expect(result).toBe("");
    });

    it("should return an empty string and log an error if an exception occurs", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("Error"));

      const result = await getAsyncStorageItem("errorKey");
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("errorKey");
      expect(consoleSpy).toHaveBeenCalledWith(
        "AsyncStorage getItem error:",
        expect.any(Error),
      );
      expect(result).toBe("");

      consoleSpy.mockRestore();
    });
  });

  describe("setAsyncStorageItem", () => {
    it("should set the value for the given key", async () => {
      await setAsyncStorageItem("testKey", "testValue");
      expect(AsyncStorage.setItem).toHaveBeenCalledWith("testKey", "testValue");
    });

    it("should log an error if an exception occurs while setting the value", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error("Error"));

      await setAsyncStorageItem("errorKey", "errorValue");
      expect(consoleSpy).toHaveBeenCalledWith(
        "AsyncStorage setItem error:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("removeAsyncStorageItem", () => {
    it("should remove the item for the given key", async () => {
      await removeAsyncStorageItem("testKey");
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("testKey");
    });

    it("should log an error if an exception occurs while removing the item", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
        new Error("Error"),
      );

      await removeAsyncStorageItem("errorKey");
      expect(consoleSpy).toHaveBeenCalledWith(
        "AsyncStorage removeItem error:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
