import { ThemedView } from "@/components/ThemedView";
import auth from "@react-native-firebase/auth";
import {
  GoogleSignin,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";
import * as googleServices from "@/google-services.json";
import { openDatabase } from "@/utils/database";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";

const logo = require("@/assets/images/icon.png");

export default function LoginScreen() {
  const queryClient = useQueryClient();
  GoogleSignin.configure({
    webClientId: googleServices.client[0].oauth_client[1].client_id,
  });

  async function saveLoginShown() {
    const db = await openDatabase("userData.db");

    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      ["loginShown", "true"],
    );
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await queryClient.refetchQueries({ queryKey: ["settings"] });
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
    } catch (error) {
      console.log("handleSignIn error", error);
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
      <ThemedText style={styles.benefit}>• Backup and restore data</ThemedText>
      <ThemedText style={styles.benefit}>
        • Sync your data across devices automatically *
      </ThemedText>
      <ThemedText style={styles.benefit}>
        • Share your training plans with others *
      </ThemedText>
      <ThemedText style={styles.benefit}>• Challenges and badges *</ThemedText>

      <ThemedText style={styles.info}>* in development</ThemedText>

      <ThemedText style={styles.info}>
        You can login at any time from the settings screen, if you choose to
        skip it now.
      </ThemedText>

      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        style={styles.loginButton}
        onPress={handleSignIn}
      />

      <Button style={styles.skipButton} mode="outlined" onPress={handleSkip}>
        Skip login
      </Button>
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
  loginButton: {
    height: 60,
    marginVertical: 20,
    width: "100%",
  },
  skipButton: {
    marginHorizontal: 3,
  },
});
