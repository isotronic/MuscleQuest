import { StyleSheet } from "react-native";

import EditScreenInfo from "@/components/EditScreenInfo";
import { Text, View } from "@/components/Themed";

import * as Updates from "expo-updates";

export default function TabOneScreen() {
  const runTypeMessage = Updates.isEmbeddedLaunch
    ? "This app is running from built-in code"
    : "This app is running an update";
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab One Test 1</Text>
      <Text>{runTypeMessage}</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
