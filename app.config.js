module.exports = {
  expo: {
    name: "MuscleQuest",
    slug: "musclequest",
    version: "0.0.1",
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
      versionCode: 1,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#22222d",
      },
      package: "com.isotronic.musclequest",
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
      [
        "@sentry/react-native/expo",
        {
          organization: "musclequest",
          project: "musclequest-react-native",
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
      eas: {
        projectId: "4f7b2a94-f0e0-44df-a5e5-1b7dc95a019a",
      },
    },
  },
};
