import { useState, useEffect, createContext } from "react";
import auth from "@react-native-firebase/auth";
import { AuthContextTypes } from "@/utils/types";

export const AuthContext = createContext<AuthContextTypes>({
  user: null,
  initializing: true,
});

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<AuthContextTypes["user"]>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((userState) => {
      setUser(userState);
      if (initializing) {
        setInitializing(false);
      }
    });
    return subscriber;
  }, [initializing]);

  return (
    <AuthContext.Provider value={{ user, initializing }}>
      {children}
    </AuthContext.Provider>
  );
};
