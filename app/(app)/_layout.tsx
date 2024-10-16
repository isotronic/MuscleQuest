import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
// import { useContext } from "react";
// import { AuthContext } from "@/context/AuthProvider";

export default function AppLayout() {
  // const user = useContext(AuthContext);

  // if (!user) {
  //   return <Redirect href="/login" />;
  // }

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
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
