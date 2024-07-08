import { Redirect, Stack } from "expo-router";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { ThemedText } from "@/components/ThemedText";

export default function AppLayout() {
  const { user, initializing } = useContext(AuthContext);

  if (initializing) {
import { ActivityIndicator } from 'react-native';

return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
