import { useState, useEffect, createContext } from "react";
import {
  getAuth,
  onAuthStateChanged,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { upsertUserProfile } from "../utils/userProfile";
import { notifyBugsnag } from "../utils/bugsnagDedup";
import { resolveAccountOwnership } from "../utils/accountOwnership";
import Bugsnag from "@bugsnag/expo";

// Signing in is optional: the user is null anywhere in the app when signed
// out, and also during the moment after launch before Firebase has restored
// the session. Code that acts on "signed out" (clearing state, showing a
// sign-in prompt) must check AuthLoadingContext first.
export const AuthContext = createContext<FirebaseAuthTypes.User | null>(null);
// True until the first onAuthStateChanged callback. Defaults to false so a
// tree without the provider (tests) treats the user value as settled.
export const AuthLoadingContext = createContext(false);

let resolveInitialAuth: () => void;
const initialAuth = new Promise<void>((resolve) => {
  resolveInitialAuth = resolve;
});

/**
 * The signed-in user once Firebase has restored the session at launch. For
 * work started before the provider's first auth callback, where the context
 * would still report null for a signed-in user.
 */
export const waitForAuthUser =
  async (): Promise<FirebaseAuthTypes.User | null> => {
    await initialAuth;
    return getAuth().currentUser;
  };

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (userState) => {
      setUser(userState);
      setIsAuthLoading(false);
      resolveInitialAuth();
      // Backups and sharing wait on this before acting as the new account.
      resolveAccountOwnership(userState?.uid ?? null).catch(notifyBugsnag);
      if (userState) {
        // Attribute every subsequent Bugsnag report to this user so errors
        // can be correlated to accounts and blast radius can be measured.
        // The uid only: the email and name are not sent to the reporter.
        Bugsnag.setUser(userState.uid);
        // Catches and reports internally; this is a backstop.
        upsertUserProfile(userState).catch(notifyBugsnag);
      } else {
        // Signed out: clear attribution so reports aren't tied to the last user.
        Bugsnag.setUser();
      }
    });
  }, []);

  return (
    <AuthLoadingContext.Provider value={isAuthLoading}>
      <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
    </AuthLoadingContext.Provider>
  );
};
