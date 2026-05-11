import { getApp } from "@react-native-firebase/app";
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";
import Constants from "expo-constants";

export async function setupAppCheck(): Promise<void> {
  const extra = Constants.expoConfig?.extra;
  const isDevBuild = extra?.appVariant === "development";
  const debugToken: string | undefined = extra?.appCheckDebugToken ?? undefined;

  try {
    const rnfbProvider: ReactNativeFirebaseAppCheckProvider =
      // @ts-expect-error - The types for ReactNativeFirebaseAppCheckProvider are not correctly defined, so we need to ignore the type error here.
      new ReactNativeFirebaseAppCheckProvider();
    rnfbProvider.configure({
      android: {
        provider: isDevBuild ? "debug" : "playIntegrity",
        ...(debugToken ? { debugToken } : {}),
      },
      apple: {
        provider: isDevBuild ? "debug" : "appAttestWithDeviceCheckFallback",
        ...(debugToken ? { debugToken } : {}),
      },
    });

    await initializeAppCheck(getApp(), {
      provider: rnfbProvider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.error("Failed to initialize App Check", error);
    throw error;
  }
}
