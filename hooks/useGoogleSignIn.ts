import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import {
  signInWithGoogle,
  SignInErrorReason,
  SignInResult,
} from "@/utils/auth";
import { useIsOnline } from "./useIsOnline";

// Null means the failure is not worth telling the user about.
const signInErrorMessage = (reason: SignInErrorReason): string | null => {
  switch (reason) {
    case "offline":
      return t`You're offline. Connect to the internet to sign in. You can keep training without signing in.`;
    case "playServicesMissing":
      return t`Google sign-in needs Google Play Services, which isn't available on this device. You can keep using MuscleQuest without signing in.`;
    case "accountConflict":
      return t`This email is already linked to a different sign-in method.`;
    case "inProgress":
      return null;
    default:
      return t`Couldn't sign in. Try again in a moment. If it keeps happening, contact support from Help.`;
  }
};

/**
 * Google sign-in with a pending flag and localised error messages. `signIn`
 * resolves to the result so a screen can act on success; a press while one is
 * already running resolves to null.
 */
export function useGoogleSignIn() {
  const isOnline = useIsOnline();
  const [isSigningIn, setIsSigningIn] = useState(false);
  // State lags a render behind, so a fast double press needs the ref.
  const isSigningInRef = useRef(false);

  const signIn = useCallback(async (): Promise<SignInResult | null> => {
    if (isSigningInRef.current) return null;
    isSigningInRef.current = true;
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogle({ isOnline });
      if (result.status === "error") {
        const message = signInErrorMessage(result.reason);
        if (message) {
          Alert.alert(t`Sign-in failed`, message, [{ text: t`OK` }]);
        }
      }
      return result;
    } finally {
      isSigningInRef.current = false;
      setIsSigningIn(false);
    }
  }, [isOnline]);

  return { signIn, isSigningIn, isOnline };
}
