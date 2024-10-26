const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "Muscle Quest (Dev)" : "Muscle Quest",
    slug: "musclequest",
    version: "0.8.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#22222d",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      versionCode: 11,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      adaptiveIcon: {
        foregroundImage: "./assets/images/ic_launcher_foreground.png",
        backgroundColor: "#22222d",
      },
      package: IS_DEV
        ? "com.isotronic.musclequest.dev"
        : "com.isotronic.musclequest",
      permissions: ["VIBRATE"],
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
      "@react-native-google-signin/google-signin",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "expo-router",
      "expo-asset",
      [
        "@sentry/react-native/expo",
        {
          organization: "musclequest",
          project: "musclequest-react-native",
          url: "https://sentry.io/",
          note: "Use SENTRY_AUTH_TOKEN env to authenticate with Sentry.",
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
    },
  },
};
