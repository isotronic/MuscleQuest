import { getApp } from "@react-native-firebase/app";
import {
  initializeAppCheck,
  getToken,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";
import Constants from "expo-constants";

export async function setupAppCheck(): Promise<void> {
  const extra = Constants.expoConfig?.extra;
  const isDevBuild = extra?.appVariant === "development";
  const rawDebugToken = extra?.appCheckDebugToken;
  const debugToken =
    typeof rawDebugToken === "string" ? rawDebugToken : undefined;

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

    const appCheckInstance = await initializeAppCheck(getApp(), {
      provider: rnfbProvider,
      isTokenAutoRefreshEnabled: true,
    });

    // Force-fetch the first token so this promise only resolves once Play
    // Integrity / DeviceCheck has actually completed. Without this,
    // initializeAppCheck returns as soon as the provider is configured but
    // the attestation round-trip is still in-flight, causing Firestore and
    // Storage requests that fire immediately after to go out without a token.
    await getToken(appCheckInstance);
  } catch (error) {
    console.error("Failed to initialize App Check", error);
    throw error;
  }
}
