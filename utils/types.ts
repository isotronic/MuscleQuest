import { FirebaseAuthTypes } from "@react-native-firebase/auth";

export type AuthContextTypes = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
};
