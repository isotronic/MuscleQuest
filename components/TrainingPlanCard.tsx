import React, { useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Card, Text } from "react-native-paper";
import { ThemedView } from "./ThemedView";

export default function TrainingPlanCard() {
  const animatedValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(animatedValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const cardStyle = {
    transform: [{ scale: animatedValue }],
  };

  return (
    <ThemedView style={styles.container}>
      <TouchableWithoutFeedback
        onPress={() => console.log("Card pressed")}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <Card style={styles.card}>
            <Card.Cover
              style={{ borderRadius: 10 }}
              source={{
                uri: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
              }}
            />
            <View style={styles.floatingTitleContainer}>
              <Text style={styles.floatingTitleText}>Upper Body</Text>
            </View>
          </Card>
        </Animated.View>
      </TouchableWithoutFeedback>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 10,
  },
  card: {
    height: 190,
    width: 300,
    borderRadius: 10,
    overflow: "hidden",
  },
  floatingTitleContainer: {
    position: "absolute",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  floatingTitleText: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowRadius: 1,
    textShadowOffset: { width: 2, height: 2 },
  },
});
