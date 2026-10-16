import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trans } from "@lingui/react/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppImage } from "@/components/ui";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const logo = require("@/assets/images/icon.png");

/**
 * The first screen of a new install. The library and plans load in the
 * background while the user is here and in setup.
 */
export default function WelcomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.body}>
        <AppImage source={logo} style={styles.logo} />
        <ThemedText type="title" style={styles.title}>
          <Trans>Welcome to MuscleQuest</Trans>
        </ThemedText>
        <ThemedText style={styles.text}>
          <Trans>
            Follow a plan, log every set and see your progress. Everything works
            offline.
          </Trans>
        </ThemedText>
      </View>
      <Button mode="contained" onPress={() => router.push("/setup")}>
        <Trans>Get started</Trans>
      </Button>
      <Button
        mode="text"
        style={styles.secondary}
        onPress={() =>
          router.push({
            pathname: "/login",
            params: { onboarding: "returning" },
          })
        }
      >
        <Trans>I've used MuscleQuest before</Trans>
      </Button>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    body: { flex: 1, justifyContent: "center", alignItems: "center" },
    logo: { width: 160, height: 160, marginBottom: 24 },
    title: {
      textAlign: "center",
      marginBottom: 12,
      color: colors.contentPrimary,
    },
    text: { textAlign: "center", color: colors.contentSecondary },
    secondary: { marginTop: 8 },
  });
}
