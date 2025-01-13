import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "@/utils/database";
import { initializeAppData } from "@/utils/initAppDataDB";

const mockDatabase = {
  getFirstAsync: jest.fn(),
};

describe("initializeAppData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (openDatabase as jest.Mock).mockReturnValue(mockDatabase);
  });

  it("should not copy database if it exists and dataVersion is sufficient", async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
    }); // appData2.db
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
    }); // appData1.db
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it("should copy database if it does not exist", async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
    }); // appData2.db
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
    }); // appData1.db
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled(); // Ensure asset is loaded
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: "mockDatabaseFileUri",
      to: "/mock/document/directory/SQLite/appData2.db",
    });
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it("should copy database if dataVersion is outdated", async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
    }); // appData2.db
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
    }); // appData1.db
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "1.5" });

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: "mockDatabaseFileUri",
      to: "/mock/document/directory/SQLite/appData2.db",
    });
  });

  it("should delete old database if it exists", async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
    }); // appData2.db
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
    }); // appData1.db
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "/mock/document/directory/SQLite/appData1.db",
    );
  });

  it("should proceed if dataVersion retrieval fails", async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
    }); // appData2.db
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
    }); // appData1.db
    mockDatabase.getFirstAsync.mockRejectedValue(
      new Error("Table does not exist"),
    );

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: "mockDatabaseFileUri",
      to: "/mock/document/directory/SQLite/appData2.db",
    });
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
