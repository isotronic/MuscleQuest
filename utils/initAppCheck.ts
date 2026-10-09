import { getApp } from "@react-native-firebase/app";
import {
  initializeAppCheck,
  getToken,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";
import Constants from "expo-constants";
import Bugsnag from "@bugsnag/expo";

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

  // Best-effort: fetch the first token so callers of appCheckReady() can make
  // their first Firestore/Storage request with it. If attestation fails (e.g.
  // Play Integrity 403 due to a missing SHA fingerprint), App Check is still
  // initialised and retries via isTokenAutoRefreshEnabled, so this resolves
  // rather than throws.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getToken(appCheckInstance),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("App Check token fetch timed out")),
          8000,
        );
      }),
    ]);
  } catch (tokenError) {
    console.error("App Check token fetch failed (non-fatal):", tokenError);
  } finally {
    clearTimeout(timeout);
  }
}

let ready: Promise<void> | undefined;

// Starts App Check on the first call and returns the same promise after that.
// It settles within the 8 s token timeout above and never rejects. If
// initialisation itself fails, the next call starts it again. Startup
// does not wait for it (App Check only guards Firebase requests, and local
// data needs none), so code that makes the first Firebase request of a flow
// awaits it instead: the social listeners and startup sync, backup and
// restore, and the profile upsert after sign-in.
export function appCheckReady(): Promise<void> {
  ready ??= setupAppCheck().catch((error) => {
    console.error(error);
    Bugsnag.notify(error);
    ready = undefined;
  });
  return ready;
}
