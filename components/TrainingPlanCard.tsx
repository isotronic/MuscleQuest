import React, { useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Card, Text } from "react-native-paper";
import { ThemedView } from "./ThemedView";
import { Colors } from "@/constants/Colors";

export default function TrainingPlanCard({
  title,
  imageUrl,
  onPress,
  isActive,
}: {
  title?: string;
  imageUrl?: string;
  onPress: () => void;
  isActive: boolean;
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
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
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
    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.75)",
  },
  activeBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: Colors.dark.completed,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: Colors.dark.text,
    fontWeight: "bold",
  },
});
