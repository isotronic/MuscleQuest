const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "Muscle Quest (Dev)" : "Muscle Quest",
    slug: "musclequest",
    version: "0.16.4", // MM.mm.pp
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "musclequest",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#22222d",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.isotronic.musclequest",
    },
    android: {
      versionCode: 1604, // MMmmpp
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/ic_launcher_foreground.png",
        backgroundColor: "#22222d",
      },
      package: IS_DEV
        ? "com.isotronic.musclequest.dev"
        : "com.isotronic.musclequest",
      permissions: ["VIBRATE", "WAKE_LOCK", "SCHEDULE_EXACT_ALARM"],
      blockedPermissions: [
        "com.google.android.gms.permission.AD_ID",
        "android.permission.READ_MEDIA_VIDEO",
      ],
    },
    androidNavigationBar: {
      backgroundColor: "#22222d",
      barStyle: "dark-content",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "@bugsnag/plugin-expo-eas-sourcemaps",
      "@react-native-google-signin/google-signin",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "expo-router",
      "expo-asset",
      [
        "expo-image-picker",
        {
          photosPermission:
            "The app accesses your photos to let you add an image to your custom exercise.",
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "node_modules/@expo-google-fonts/inter/Inter_100Thin.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_200ExtraLight.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_300Light.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_400Regular.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_500Medium.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_600SemiBold.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_700Bold.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_800ExtraBold.ttf",
            "node_modules/@expo-google-fonts/inter/Inter_900Black.ttf",
          ],
        },
      ],
      [
        "expo-notifications",
        {
          sounds: ["./assets/sounds/boxing_bell.mp3"],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      appVariant: process.env.APP_VARIANT || "production",
      eas: {
        projectId: "4f7b2a94-f0e0-44df-a5e5-1b7dc95a019a",
      },
      bugsnag: {
        apiKey: process.env.EXPO_PUBLIC_BUGSNAG_API_KEY,
      },
    },
  },
};
