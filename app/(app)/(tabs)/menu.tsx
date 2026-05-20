import { Redirect } from "expo-router";

export default function MenuTabFallback() {
  return <Redirect href="/(app)/settings" />;
}
