import { useState, useEffect, createContext } from "react";
import { getAuth, FirebaseAuthTypes } from "@react-native-firebase/auth";

export const AuthContext = createContext<FirebaseAuthTypes.User | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    return auth.onAuthStateChanged((userState) => {
      setUser(userState);
    });
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
};
