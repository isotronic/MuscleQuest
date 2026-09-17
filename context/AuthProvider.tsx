import { useState, useEffect, createContext } from "react";
import {
  getAuth,
  onAuthStateChanged,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { upsertUserProfile } from "../utils/userProfile";
import Bugsnag from "@bugsnag/expo";

export const AuthContext = createContext<FirebaseAuthTypes.User | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (userState) => {
      setUser(userState);
      if (userState) {
        // Attribute every subsequent Bugsnag report to this user so errors
        // can be correlated to accounts and blast radius can be measured.
        Bugsnag.setUser(
          userState.uid,
          userState.email ?? undefined,
          userState.displayName ?? undefined,
        );
        upsertUserProfile(userState);
      } else {
        // Signed out: clear attribution so reports aren't tied to the last user.
        Bugsnag.setUser();
      }
    });
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
};
