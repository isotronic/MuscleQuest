import auth from "@react-native-firebase/auth";
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
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);
  } catch (error) {
    const typedError = error as { code?: string };

    // Code 12501 means user cancelled sign in
    if (typedError.code !== "12501") {
      console.error("Sign in error", error);
      Alert.alert("Error", "Failed to sign in. Please try again.");
    }

    throw error;
  }
};
