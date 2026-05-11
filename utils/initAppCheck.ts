import { getApp } from "@react-native-firebase/app";
import appCheck, { initializeAppCheck } from "@react-native-firebase/app-check";
import Constants from "expo-constants";

export async function setupAppCheck(): Promise<void> {
  const extra = Constants.expoConfig?.extra;
  const isDevBuild = extra?.appVariant === "development";
  const debugToken: string | undefined = extra?.appCheckDebugToken ?? undefined;

  try {
    const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
    rnfbProvider.configure({
      android: {
        provider: isDevBuild ? "debug" : "playIntegrity",
        debugToken,
      },
      apple: {
        provider: isDevBuild ? "debug" : "appAttestWithDeviceCheckFallback",
        debugToken,
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
