import { Colors } from "@/constants/Colors";
import { Redirect, Stack } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { ThemedView } from "@/components/ThemedView";

export default function AppLayout() {
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery();

  if (settingsLoading) {
    return <ThemedView style={{ flex: 1 }}></ThemedView>;
  }

  if (settings && !settings.loginShown) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(create-plan)" options={{ headerShown: false }} />
      <Stack.Screen name="(workout)" options={{ headerShown: false }} />
      <Stack.Screen
        name="exercise-details"
        options={{ title: "Exercise Details" }}
      />
      <Stack.Screen
        name="custom-exercise"
        options={{ title: "Create Custom Exercise" }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
