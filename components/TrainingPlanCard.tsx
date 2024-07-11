import { ThemedView } from "./ThemedView";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";

export default function TrainingPlanCard() {
  return (
    <ThemedView style={styles.container}>
      <Card style={styles.card}>
        <Card.Cover
          style={{ borderRadius: 10 }}
          source={{
            uri: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          }}
        />

        <View
          style={{
            position: "absolute",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              color: "white",
              fontWeight: "bold",
              textAlign: "center",
              textShadowColor: "rgba(0, 0, 0, 0.75)",
              textShadowRadius: 1,
              textShadowOffset: { width: 2, height: 2 },
            }}
          >
            Upper Body
          </Text>
        </View>
      </Card>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 10,
  },
  card: {
    height: 180,
    width: 300,
  },
});
