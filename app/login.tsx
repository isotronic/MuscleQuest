import { ThemedView } from "@/components/ThemedView";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { openDatabase } from "@/utils/database";
import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Button } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import Bugsnag from "@bugsnag/expo";
import { ScrollView } from "react-native";
import { useMemo } from "react";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const logo = require("@/assets/images/icon.png");

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  async function saveLoginShown() {
    try {
      const db = await openDatabase("userData.db");

      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ["loginShown", "true"],
      );
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.refetchQueries({ queryKey: ["settings"] });
    } catch (error: any) {
      Bugsnag.notify(error);
    }
  }

  async function handleSignIn() {
    try {
      const hasPlayServices = await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      if (!hasPlayServices) {
        throw new Error("Play services not available");
      }
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const auth = getAuth();
      await signInWithCredential(auth, googleCredential);
      await saveLoginShown(); // Save setting to avoid showing login again
      router.replace("/");
    } catch (error: any) {
      // User cancelled sign in — don't report to Bugsnag
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      console.error("handleSignIn error", error);
      Bugsnag.notify(error);
      Alert.alert(t`Error`, t`Failed to sign in. Please try again.`, [
        { text: t`OK` },
      ]);
    }
  }

  async function handleSkip() {
    await saveLoginShown(); // Save setting to skip login in the future
    router.replace("/");
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Image source={logo} style={styles.logo} />
        <ThemedText style={styles.welcomeText}>
          <Trans>Welcome to MuscleQuest!</Trans>
        </ThemedText>
        <ThemedText style={styles.benefitsText}>
          <Trans>Benefits of logging in:</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Backup and restore data</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Share your training plans with others *</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Challenges and badges *</Trans>
        </ThemedText>

        <ThemedText style={styles.info}>
          <Trans>* features in development</Trans>
        </ThemedText>

        <ThemedText style={styles.info}>
          <Trans>
            You can login at any time from the settings screen, if you choose to
            skip it now.
          </Trans>
        </ThemedText>

        <View style={styles.buttonRow}>
          <Button
            style={styles.skipButton}
            mode="outlined"
            onPress={handleSkip}
          >
            <Trans>Skip login</Trans>
          </Button>

          <Button
            style={styles.loginButton}
            mode="contained"
            onPress={handleSignIn}
            accessibilityLabel={t`Google sign in`}
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
