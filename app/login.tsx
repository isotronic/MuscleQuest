import { ThemedView } from "@/components/ThemedView";
import auth from "@react-native-firebase/auth";
import {
  GoogleSignin,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";
import * as googleServices from "../google-services.json";
import { router } from "expo-router";

export default function LoginScreen() {
  GoogleSignin.configure({
    webClientId: googleServices.client[0].oauth_client[1].client_id,
  });

  async function handleSignIn() {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      return auth().signInWithCredential(googleCredential);
    } catch (error) {
      console.log(error);
    }
  }
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={() => {
          handleSignIn().then(() => {
            router.replace("/");
          });
        }}
      />
    </ThemedView>
  );
}
