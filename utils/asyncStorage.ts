import AsyncStorage from "@react-native-async-storage/async-storage";
import Bugsnag from "@bugsnag/expo";

export const getAsyncStorageItem = async (key: string): Promise<string> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value || "";
  } catch (error: unknown) {
    Bugsnag.notify(error as Error);
    console.error("AsyncStorage getItem error:", error);
    return "";
  }
};

export const setAsyncStorageItem = async (
  key: string,
  value: string,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error: unknown) {
    Bugsnag.notify(error as Error);
    console.error("AsyncStorage setItem error:", error);
  }
};

export const removeAsyncStorageItem = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error: unknown) {
    Bugsnag.notify(error as Error);
    console.error("AsyncStorage removeItem error:", error);
  }
};
