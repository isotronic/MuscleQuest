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
  let mockDbFileDelete: jest.Mock;
  let mockOldDb1FileDelete: jest.Mock;
  let mockOldDb2FileDelete: jest.Mock;
  let mockAssetFileCopy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (openDatabase as jest.Mock).mockReturnValue(mockDatabase);

    mockDirCreate = jest.fn();
    mockDbFileDelete = jest.fn();
    mockOldDb1FileDelete = jest.fn();
    mockOldDb2FileDelete = jest.fn();
    mockAssetFileCopy = jest.fn();

    MockDirectory.mockImplementation(() => ({ create: mockDirCreate }));
  });

  const setupFileMocks = (
    dbExists: boolean,
    oldDb1Exists: boolean,
    oldDb2Exists: boolean,
  ) => {
    MockFile.mockImplementationOnce(() => ({
      exists: dbExists,
      delete: mockDbFileDelete,
      uri: "/mock/document/directory/SQLite/appData3.db",
    })); // dbFile
    MockFile.mockImplementationOnce(() => ({
      exists: oldDb1Exists,
      delete: mockOldDb1FileDelete,
      uri: "/mock/document/directory/SQLite/appData1.db",
    })); // oldDbFile1
    MockFile.mockImplementationOnce(() => ({
      exists: oldDb2Exists,
      delete: mockOldDb2FileDelete,
      uri: "/mock/document/directory/SQLite/appData2.db",
    })); // oldDbFile2
    MockFile.mockImplementation(() => ({
      exists: true,
      copy: mockAssetFileCopy,
      uri: "mockDatabaseFileUri",
    })); // asset file (if copy is triggered)
  };

  it("should not copy database if it exists and dataVersion is sufficient", async () => {
    setupFileMocks(true, false, false);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(mockDirCreate).toHaveBeenCalledWith({
      intermediates: true,
      idempotent: true,
    });
    expect(mockAssetFileCopy).not.toHaveBeenCalled();
    expect(mockOldDb1FileDelete).not.toHaveBeenCalled();
    expect(mockOldDb2FileDelete).not.toHaveBeenCalled();
  });

  it("should copy database if it does not exist", async () => {
    setupFileMocks(false, false, false);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(mockAssetFileCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: "/mock/document/directory/SQLite/appData3.db",
      }),
    );
    expect(mockOldDb1FileDelete).not.toHaveBeenCalled();
    expect(mockOldDb2FileDelete).not.toHaveBeenCalled();
  });

  it("should copy database if dataVersion is outdated", async () => {
    setupFileMocks(true, false, false);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "1.5" });

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(mockAssetFileCopy).toHaveBeenCalled();
  });

  it("should delete old database files if they exist", async () => {
    setupFileMocks(true, true, true);
    mockDatabase.getFirstAsync.mockResolvedValue({ value: "2.0" });

    await initializeAppData();

    expect(mockAssetFileCopy).not.toHaveBeenCalled();
    expect(mockOldDb1FileDelete).toHaveBeenCalled();
    expect(mockOldDb2FileDelete).toHaveBeenCalled();
  });

  it("should proceed if dataVersion retrieval fails", async () => {
    setupFileMocks(false, false, false);
    mockDatabase.getFirstAsync.mockRejectedValue(
      new Error("Table does not exist"),
    );

    await initializeAppData();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(mockAssetFileCopy).toHaveBeenCalled();
    expect(mockOldDb1FileDelete).not.toHaveBeenCalled();
    expect(mockOldDb2FileDelete).not.toHaveBeenCalled();
  });
});
