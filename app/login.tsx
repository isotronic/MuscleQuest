import { ThemedView } from "@/components/ThemedView";
import { openDatabase } from "@/utils/database";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Button } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { AppImage } from "@/components/ui";
import Bugsnag from "@bugsnag/expo";
import { ScrollView } from "react-native";
import { useMemo } from "react";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";

const logo = require("@/assets/images/icon.png");

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { signIn, isSigningIn, isOnline } = useGoogleSignIn();

  async function saveLoginShown() {
    try {
      const db = await openDatabase("userData.db");

      try {
        await db.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["loginShown", "true"],
        );
        await queryClient.invalidateQueries({ queryKey: ["settings"] });
        await queryClient.refetchQueries({ queryKey: ["settings"] });
      } finally {
        await db.closeAsync();
      }
    } catch (error: any) {
      Bugsnag.notify(error);
    }
  }

  async function handleSignIn() {
    const result = await signIn();
    if (result?.status !== "success") return;
    await saveLoginShown(); // Save setting to avoid showing login again
    router.replace("/");
  }

  async function handleSkip() {
    await saveLoginShown(); // Save setting to skip login in the future
    router.replace("/");
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <AppImage source={logo} style={styles.logo} />
        <ThemedText style={styles.welcomeText}>
          <Trans>Welcome to MuscleQuest!</Trans>
        </ThemedText>
        <ThemedText style={styles.benefitsText}>
          <Trans>Benefits of logging in:</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Back up and restore all your workout data</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Add friends and browse their shared content</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>
            • Share your plans, workouts, exercises, and body measurements
          </Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>
            • Import plans and workouts from friends into your library
          </Trans>
        </ThemedText>

        <ThemedText style={styles.info}>
          <Trans>
            You can log in at any time from the settings screen, if you choose
            to skip it now.
          </Trans>
        </ThemedText>

        {!isOnline && (
          <ThemedText style={styles.info}>
            <Trans>
              Sign-in needs an internet connection. You can skip for now and
              sign in later from settings.
            </Trans>
          </ThemedText>
        )}

        <View style={styles.buttonRow}>
          <Button
            style={styles.skipButton}
            mode="outlined"
            onPress={handleSkip}
            disabled={isSigningIn}
            testID="login-skip"
          >
            <Trans>Skip login</Trans>
          </Button>

          <Button
            style={styles.loginButton}
            mode="contained"
            onPress={handleSignIn}
            loading={isSigningIn}
            disabled={isSigningIn || !isOnline}
            accessibilityLabel={t`Google sign in`}
            testID="login-google"
          >
            <Trans>Google sign in</Trans>
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      padding: 20,
      paddingTop: 60,
      backgroundColor: colors.background,
    },
    logo: {
      width: 200,
      height: 200,
      alignSelf: "center",
      marginBottom: 20,
    },
    welcomeText: {
      fontSize: 26,
      lineHeight: 26,
      fontWeight: "bold",
      marginBottom: 20,
    },
    benefitsText: {
      fontWeight: "bold",
      marginBottom: 10,
    },
    benefit: {
      marginBottom: 5,
    },
    info: {
      fontStyle: "italic",
      marginVertical: 5,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: 20,
    },
    loginButton: {},
    skipButton: {
      marginRight: 10,
    },
  });
}
