import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import { Button } from "react-native-paper";

export default function CreatePlanLayout() {
  const handleSavePlan = () => {};
  return (
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
    </Stack>
  );
}
