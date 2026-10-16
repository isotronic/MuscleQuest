import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";

/** Shown in onboarding when the exercise library or plans failed to load. */
export function SeedingFailedNotice({ onRetry }: { onRetry: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container} accessibilityRole="alert">
      <ThemedText style={{ color: colors.contentPrimary }}>
        <Trans>
          Couldn't finish setting up. Check your storage and try again.
        </Trans>
      </ThemedText>
      <Button mode="contained" onPress={onRetry} testID="seeding-retry">
        <Trans>Try again</Trans>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 12 },
});
