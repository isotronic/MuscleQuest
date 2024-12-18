import * as FileSystem from "expo-file-system";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";

const getDatabasePath = () => {
  return `${FileSystem.documentDirectory}SQLite/userData.db`;
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

    const storageRef = storage().ref(`backups/${userId}/userData.db`);
    const dbPath = getDatabasePath();
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
