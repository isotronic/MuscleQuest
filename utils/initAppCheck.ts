import { getApp } from "@react-native-firebase/app";
import { initializeAppCheck } from "@react-native-firebase/app-check";
import Constants from "expo-constants";

export async function setupAppCheck(): Promise<void> {
  const extra = Constants.expoConfig?.extra;
  const isDevBuild = extra?.appVariant === "development";
  const debugToken: string | undefined = extra?.appCheckDebugToken ?? undefined;

  await initializeAppCheck(getApp(), {
    provider: {
      providerOptions: {
        android: {
          provider: isDevBuild ? "debug" : "playIntegrity",
          debugToken,
        },
        apple: {
          provider: isDevBuild ? "debug" : "appAttest",
          debugToken,
        },
      },
    },
    isTokenAutoRefreshEnabled: true,
  });
}
