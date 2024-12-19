import AsyncStorage from "@react-native-async-storage/async-storage";

const DB_NAME_KEY = "activeDatabase";

export const getActiveDatabaseName = async (): Promise<string> => {
  const dbName = await AsyncStorage.getItem(DB_NAME_KEY);
  return dbName || "userData.db"; // Default to 'userData.db' if not set
};

export const setActiveDatabaseName = async (dbName: string): Promise<void> => {
  await AsyncStorage.setItem(DB_NAME_KEY, dbName);
};
