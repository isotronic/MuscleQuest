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
                uri: imageUrl,
              }}
            />
            <View style={styles.floatingTitleContainer}>
              <Text style={styles.floatingTitleText}>
                {title || "Training Plan"}
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
    bottom: 0,
    width: "100%",
    paddingVertical: 5,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  floatingTitleText: {
    fontSize: 22,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowRadius: 4,
    textShadowOffset: { width: 2, height: 2 },
  },
});
