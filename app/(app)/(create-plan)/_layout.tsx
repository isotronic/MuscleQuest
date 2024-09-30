import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function CreatePlanLayout() {
  return (
    <GestureHandlerRootView>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.dark.background,
          },
          headerTintColor: Colors.dark.text,
        }}
      >
        <Stack.Screen name="create" options={{ title: "Create Plan" }} />
        <Stack.Screen
          name="image-search"
          options={{ title: "Images by Unsplash" }}
        />
        <Stack.Screen name="exercises" options={{ title: "Exercises" }} />
        <Stack.Screen
          name="exercise-details"
          options={{ title: "Exercise Details" }}
        />
        <Stack.Screen
          name="sets-overview"
          options={{ title: "Sets Overview" }}
        />
        <Stack.Screen name="edit-set" options={{ title: "Edit Set" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
