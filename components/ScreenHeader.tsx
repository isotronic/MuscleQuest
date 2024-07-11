import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

export default function ScreenHeader({ title }: { title: string }) {
  return (
    <ThemedView
      style={{
        paddingLeft: 20,
        paddingTop: 10,
        paddingBottom: 10,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.75,
        shadowRadius: 5,
        elevation: 5,
      }}
    >
      <ThemedText type="subtitle">{title}</ThemedText>
    </ThemedView>
  );
}
