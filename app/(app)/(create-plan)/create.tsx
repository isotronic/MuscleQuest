import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CreatePlanScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView>
      <ThemedView style={{ marginTop: insets.top }}>
        <ThemedText type="title">Create Plan</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}
