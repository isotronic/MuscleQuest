import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { notifyBugsnag } from "./bugsnagDedup";

export type SignInErrorReason =
  | "offline"
  | "playServicesMissing"
  | "inProgress"
  | "accountConflict"
  | "unknown";

export type SignInResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; reason: SignInErrorReason; error: unknown };

const classifySignInError = (code: string | undefined): SignInErrorReason => {
  switch (code) {
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return "playServicesMissing";
    case statusCodes.IN_PROGRESS:
      return "inProgress";
    case "auth/network-request-failed":
      return "offline";
    case "auth/account-exists-with-different-credential":
      return "accountConflict";
    default:
      return "unknown";
  }
};

// The single Google sign-in implementation. It never shows UI; callers turn
// the result into a message (see hooks/useGoogleSignIn.ts).
export const signInWithGoogle = async ({
  isOnline = true,
}: { isOnline?: boolean } = {}): Promise<SignInResult> => {
  if (!isOnline) {
    return { status: "error", reason: "offline", error: null };
  }
  try {
    const hasPlayServices = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    if (!hasPlayServices) {
      return { status: "error", reason: "playServicesMissing", error: null };
    }
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(getAuth(), googleCredential);
    return { status: "success" };
  } catch (error: any) {
    const code: string | undefined = error?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: "cancelled" };
    }

    const reason = classifySignInError(code);
    if (reason === "unknown") {
      console.error("Sign in error", error);
      notifyBugsnag(error, (event) => {
        event.addMetadata("sign_in_error", {
          code,
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
        });
      });
    }
    return { status: "error", reason, error };
  }
};
