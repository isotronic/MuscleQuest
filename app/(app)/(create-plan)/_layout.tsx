import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button } from "react-native-paper";

export default function CreatePlanLayout() {
  const handleSavePlan = () => {};
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
        <Stack.Screen
          name="create"
          options={{
            title: "Create Plan",
            headerRight: () => <Button mode="text" onPress={handleSavePlan} />,
          }}
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
