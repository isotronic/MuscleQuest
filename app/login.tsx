import { ThemedView } from "@/components/ThemedView";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { openDatabase } from "@/utils/database";
import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import Bugsnag from "@bugsnag/expo";

const logo = require("@/assets/images/icon.png");

export default function LoginScreen() {
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
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      await saveLoginShown(); // Save setting to avoid showing login again
      router.replace("/");
    } catch (error: any) {
      console.error("handleSignIn error", error);
      Bugsnag.notify(error);
      Alert.alert("Error", "Failed to sign in. Please try again.", [
        { text: "OK" },
      ]);
    }
  }

  async function handleSkip() {
    await saveLoginShown(); // Save setting to skip login in the future
    router.replace("/");
  }

  return (
    <ThemedView style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <ThemedText style={styles.welcomeText}>
        Welcome to MuscleQuest!
      </ThemedText>
      <ThemedText style={styles.benefitsText}>
        Benefits of logging in:
      </ThemedText>
      <ThemedText style={styles.benefit}>
        • Backup and restore data *
      </ThemedText>
      <ThemedText style={styles.benefit}>
        • Sync your data across devices automatically *
      </ThemedText>
      <ThemedText style={styles.benefit}>
        • Share your training plans with others *
      </ThemedText>
      <ThemedText style={styles.benefit}>• Challenges and badges *</ThemedText>

      <ThemedText style={styles.info}>* features in development</ThemedText>

      <ThemedText style={styles.info}>
        You can login at any time from the settings screen, if you choose to
        skip it now.
      </ThemedText>

      <View style={styles.buttonRow}>
        <Button style={styles.skipButton} mode="outlined" onPress={handleSkip}>
          Skip login
        </Button>

        <Button
          style={styles.loginButton}
          mode="contained"
          onPress={handleSignIn}
          accessibilityLabel="Login"
        >
          Sign in with Google
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.dark.background,
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
  skipButton: {},
});
