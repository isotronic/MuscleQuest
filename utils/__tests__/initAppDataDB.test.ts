import { File, Directory } from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "@/utils/database";
import { initializeAppData } from "@/utils/initAppDataDB";

const MockFile = File as unknown as jest.Mock;
const MockDirectory = Directory as unknown as jest.Mock;

const mockDatabase = {
  getFirstAsync: jest.fn(),
};

describe("initializeAppData", () => {
  let mockDirCreate: jest.Mock;
  let mockDbFileCopy: jest.Mock;
  let mockOldDbFileDelete: jest.Mock;
  let mockAssetFileCopy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (openDatabase as jest.Mock).mockReturnValue(mockDatabase);

    mockDirCreate = jest.fn();
    mockDbFileCopy = jest.fn();
    mockOldDbFileDelete = jest.fn();
    mockAssetFileCopy = jest.fn();

    MockDirectory.mockImplementation(() => ({ create: mockDirCreate }));
  });

  const setupFileMocks = (dbExists: boolean, oldDbExists: boolean) => {
    MockFile.mockImplementationOnce(() => ({
      exists: dbExists,
      copy: mockDbFileCopy,
      uri: "/mock/document/directory/SQLite/appData2.db",
    })); // dbFile
    MockFile.mockImplementationOnce(() => ({
      exists: oldDbExists,
      delete: mockOldDbFileDelete,
      uri: "/mock/document/directory/SQLite/appData1.db",
    })); // oldDbFile
    MockFile.mockImplementation(() => ({
      exists: true,
      copy: mockAssetFileCopy,
      uri: "mockDatabaseFileUri",
    })); // asset file (if copy is triggered)
  };

  it("should not copy database if it exists and dataVersion is sufficient", async () => {
    setupFileMocks(true, false);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(mockDirCreate).toHaveBeenCalledWith({
      intermediates: true,
      idempotent: true,
    });
    expect(mockAssetFileCopy).not.toHaveBeenCalled();
    expect(mockOldDbFileDelete).not.toHaveBeenCalled();
  });

  it("should copy database if it does not exist", async () => {
    setupFileMocks(false, false);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(mockAssetFileCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: "/mock/document/directory/SQLite/appData2.db",
      }),
    );
    expect(mockOldDbFileDelete).not.toHaveBeenCalled();
  });

  it("should copy database if dataVersion is outdated", async () => {
    setupFileMocks(true, false);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "1.5" });

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(mockAssetFileCopy).toHaveBeenCalled();
  });

  it("should delete old database if it exists", async () => {
    setupFileMocks(true, true);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(mockAssetFileCopy).not.toHaveBeenCalled();
    expect(mockOldDbFileDelete).toHaveBeenCalled();
  });

  it("should proceed if dataVersion retrieval fails", async () => {
    setupFileMocks(false, false);
    mockDatabase.getFirstAsync.mockRejectedValue(
      new Error("Table does not exist"),
    );

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(mockAssetFileCopy).toHaveBeenCalled();
    expect(mockOldDbFileDelete).not.toHaveBeenCalled();
  });
});
