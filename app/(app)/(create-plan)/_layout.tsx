import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";

export default function CreatePlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
      }}
    >
      <Stack.Screen name="create" options={{ title: "Create Plan" }} />
    </Stack>
  );
}
