import * as FileSystem from "expo-file-system";
import { reloadAsync } from "expo-updates";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { getActiveDatabaseName, setActiveDatabaseName } from "./asyncStorage";

const getDatabasePath = async () => {
  const dbName = await getActiveDatabaseName();
  return `${FileSystem.documentDirectory}SQLite/${dbName}`;
};

export const uploadDatabaseBackup = async (
  setBackupProgress: (progress: number) => void,
  setIsBackupLoading: (loading: boolean) => void,
) => {
  try {
    setIsBackupLoading(true); // Start the loading state

    const userId = 1; // Replace with auth().currentUser?.uid logic
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const dbName = await getActiveDatabaseName();

    const storageRef = storage().ref(`backups/${userId}/${dbName}`);
    const dbPath = await getDatabasePath();
    const fileStat = await FileSystem.getInfoAsync(dbPath);

    // Check if the file exists
    if (!fileStat.exists) {
      throw new Error("Database file does not exist");
    }

    // Upload file to Firebase Storage
    const task = storageRef.putFile(dbPath);

    // Monitor upload progress
    task.on("state_changed", (taskSnapshot) => {
      const progress =
        (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 100;
      setBackupProgress(progress); // Update the progress bar
      console.log(`${progress.toFixed(2)}% uploaded`);
    });

    await task;
    console.log("Database backup uploaded successfully");
  } catch (error) {
    console.error("Error uploading backup:", error);
  } finally {
    setIsBackupLoading(false); // End the loading state
    setBackupProgress(1);
  }
};

export const fetchLastBackupDate = async (): Promise<Date | null> => {
  try {
    const userId = 1; // Replace with auth().currentUser?.uid logic
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const dbName = await getActiveDatabaseName();

    const storageRef = storage().ref(`backups/${userId}/${dbName}`);
    const metadata = await storageRef.getMetadata();

    if (metadata.updated) {
      return new Date(metadata.updated); // Parse the "updated" timestamp into a Date object
    }

    return null; // Return null if no updated timestamp is available
  } catch (error) {
    console.error("Error fetching last backup date:", error);
    return null;
  }
};

export const restoreDatabaseBackup = async (
  setRestoreProgress: (progress: number) => void,
  setIsRestoreLoading: (loading: boolean) => void,
) => {
  try {
    setIsRestoreLoading(true);

    const userId = 1; // Replace with auth().currentUser?.uid logic
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const oldDbName = await getActiveDatabaseName();

    const storageRef = storage().ref(`backups/${userId}/${oldDbName}`);
    const downloadUrl = await storageRef.getDownloadURL();

    const newDbName = `userData_${Date.now()}.db`;
    const newDbPath = `${FileSystem.documentDirectory}SQLite/${newDbName}`;

    // Download the backup file
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      newDbPath,
      undefined,
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        setRestoreProgress(progress);
      },
    );

    await downloadResumable.downloadAsync();
    console.log(`Database restored as: ${newDbName}`);

    // Update active database name in AsyncStorage
    await setActiveDatabaseName(newDbName);

    console.log("Active database updated successfully.");
  } catch (error) {
    console.error("Error restoring database:", error);
    throw error;
  } finally {
    setIsRestoreLoading(false);
    setRestoreProgress(1);
    await reloadAsync();
  }
};
