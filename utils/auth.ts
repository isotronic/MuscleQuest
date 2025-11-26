import Bugsnag from "@bugsnag/expo";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Alert } from "react-native";

export const signInWithGoogle = async () => {
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
  } catch (error: any) {
    const typedError = error as { code?: string };

    // Code 12501 means user cancelled sign in
    if (typedError.code !== "12501") {
      console.error("Sign in error", error);
      Alert.alert("Error", "Failed to sign in. Please try again.");
    }

    // Log detailed error info to Bugsnag for debugging
    Bugsnag.notify(error, (event) => {
      event.addMetadata("sign_in_error", {
        code: typedError.code,
        errorString: JSON.stringify(error),
      });
    });
    throw error;
  }
};
