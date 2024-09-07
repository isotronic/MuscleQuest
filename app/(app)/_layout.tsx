import { Redirect, Stack } from "expo-router";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export default function AppLayout() {
  const user = useContext(AuthContext);

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(create-plan)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
