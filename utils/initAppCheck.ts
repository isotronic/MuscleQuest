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

  // Best-effort: warm up the first token so it's ready before Firestore/Storage
  // requests fire. If attestation fails (e.g. Play Integrity 403 due to missing
  // SHA fingerprint), App Check is still initialized and will retry via
  // isTokenAutoRefreshEnabled. Don't re-throw so a transient attestation failure
  // doesn't block or delay startup.
  try {
    await getToken(appCheckInstance);
  } catch (tokenError) {
    console.error("App Check token fetch failed (non-fatal):", tokenError);
  }
}
