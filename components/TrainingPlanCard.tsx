import React, { useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Card, Text } from "react-native-paper";
import { ThemedView } from "./ThemedView";

export default function TrainingPlanCard({
  title,
  imageUrl,
  onPress,
}: {
  title?: string;
  imageUrl?: string;
  onPress: () => void;
}) {
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

  useEffect(() => {
    return () => {
      // Stop the animation if the component unmounts
      animatedValue.stopAnimation();
    };
  }, [animatedValue]);

  const cardStyle = {
    transform: [{ scale: animatedValue }],
  };

  return (
    <ThemedView style={styles.container}>
      <TouchableWithoutFeedback
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <Card style={styles.card}>
            <Card.Cover
              style={{ borderRadius: 10 }}
              source={{
                uri:
                  imageUrl ||
                  "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
              }}
            />
            <View style={styles.floatingTitleContainer}>
              <Text style={styles.floatingTitleText}>
                {title || "Demo Plan"}
              </Text>
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
