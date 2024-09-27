import { ThemedView } from "@/components/ThemedView";
import auth from "@react-native-firebase/auth";
import {
  GoogleSignin,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";
import * as googleServices from "@/google-services.json";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

export default function LoginScreen() {
  GoogleSignin.configure({
    webClientId: googleServices.client[0].oauth_client[1].client_id,
  });

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
      return auth().signInWithCredential(googleCredential);
    } catch (error) {
      console.log("handleSignIn error", error);
    }
  }
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        style={styles.button}
        onPress={() => {
          handleSignIn().then((cred) => {
            router.replace("/");
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 70,
  },
});
