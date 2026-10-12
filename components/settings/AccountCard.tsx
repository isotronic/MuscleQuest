import { useContext } from "react";
import { Alert } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import Bugsnag from "@bugsnag/expo";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { AuthContext, AuthLoadingContext } from "@/context/AuthProvider";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { SettingRow } from "@/components/settings/SettingRow";

/** Sign in with Google, or who is signed in with a sign-out button. */
export function AccountCard() {
  const user = useContext(AuthContext);
  const isAuthLoading = useContext(AuthLoadingContext);
  const { signIn, isSigningIn, isOnline } = useGoogleSignIn();

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error: unknown) {
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
      Alert.alert(
        t`Error`,
        t`Failed to sign out of Google. Continuing sign-out.`,
      );
    }
    try {
      await signOut(getAuth());
    } catch (error: unknown) {
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
      Alert.alert(t`Error`, t`Failed to sign out. Please try again.`);
    }
  };

  if (!user) {
    return (
      <SettingRow
        id="account"
        icon="account"
        title={<Trans>Sign in with Google</Trans>}
        value={
          isOnline ? (
            <Trans>Log in to secure your data</Trans>
          ) : (
            <Trans>Sign-in needs an internet connection.</Trans>
          )
        }
        trailing={
          <Button
            mode="outlined"
            compact
            loading={isSigningIn || isAuthLoading}
            disabled={isSigningIn || isAuthLoading || !isOnline}
            onPress={() => void signIn()}
          >
            <Trans>Sign in</Trans>
          </Button>
        }
      />
    );
  }
  return (
    <SettingRow
      id="account"
      icon="account"
      title={<Trans>Signed in as {user.displayName || user.email}</Trans>}
      trailing={
        <Button mode="outlined" compact onPress={handleSignOut}>
          <Trans>Sign out</Trans>
        </Button>
      }
    />
  );
}
