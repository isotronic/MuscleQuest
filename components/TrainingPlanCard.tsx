import React, { useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Card, Text } from "react-native-paper";
import { ThemedView } from "./ThemedView";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
              style={{ borderRadius: radii.md }}
              source={{
                uri: imageUrl,
              }}
            />
            <View style={styles.floatingTitleContainer}>
              <Text style={styles.floatingTitleText}>
                {title || t`Training Plan`}
              </Text>
            </View>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  <Trans>Active</Trans>
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>
      </TouchableWithoutFeedback>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      margin: 10,
    },
    card: {
      height: 190,
      width: 300,
      borderRadius: radii.md,
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
      color: colors.contentPrimary,
      fontWeight: "bold",
      textAlign: "center",
      textShadowColor: "rgba(0, 0, 0, 0.75)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 4,
    },
    activeBadge: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
    },
    activeBadgeText: {
      color: colors.contentPrimary,
      fontWeight: "bold",
    },
  });
}
