import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Colors } from "@/constants/Colors";
import { useMenuStore } from "@/store/menuStore";

// Reanimated 4: Animated.View types don't include children in strict TS
const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  children?: React.ReactNode;
}>;

const ANIMATION_DURATION = 260;

type MenuItemProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  hint?: string;
};

function MenuItem({ icon, label, onPress, hint }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.menuItem}
      accessibilityRole="button"
      accessibilityHint={hint}
    >
      <Ionicons
        name={icon}
        size={22}
        color={Colors.dark.tint}
        style={styles.menuItemIcon}
      />
      <Text style={styles.menuItemLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.dark.subText} />
    </TouchableOpacity>
  );
}

function MenuDivider() {
  return <View style={styles.divider} />;
}

export function AppMenu() {
  const { isMenuOpen, closeMenu } = useMenuStore();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const panelWidth = Math.min(screenWidth * 0.82, 320);
  const translateX = useSharedValue(panelWidth);
  const backdropOpacity = useSharedValue(0);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isMenuOpen) {
      setIsVisible(true);
      translateX.value = withTiming(0, { duration: ANIMATION_DURATION });
      backdropOpacity.value = withTiming(1, { duration: ANIMATION_DURATION });
    } else {
      translateX.value = withTiming(panelWidth, {
        duration: ANIMATION_DURATION,
      });
      backdropOpacity.value = withTiming(
        0,
        { duration: ANIMATION_DURATION },
        (finished) => {
          "worklet";
          if (finished) scheduleOnRN(setIsVisible, false);
        },
      );
    }
  }, [isMenuOpen, panelWidth]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeMenu();
      return true;
    });
    return () => sub.remove();
  }, [isMenuOpen, closeMenu]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isVisible) return null;

  const navigate = (href: string) => {
    closeMenu();
    router.push(href as Parameters<typeof router.push>[0]);
  };

  const openLink = (url: string) => {
    closeMenu();
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Portal>
      <AnimatedView
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeMenu}
          accessibilityLabel="Close menu"
          accessibilityRole="button"
        />
      </AnimatedView>

      <AnimatedView
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            paddingRight: insets.right + 16,
          },
          panelStyle,
        ]}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>MuscleQuest</Text>
          <TouchableOpacity
            onPress={closeMenu}
            style={styles.closeButton}
            accessibilityLabel="Close menu"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <MenuDivider />

        <MenuItem
          icon="help-circle-outline"
          label="Help & Info"
          onPress={() => navigate("/(app)/help")}
        />
        <MenuItem
          icon="settings-outline"
          label="Settings"
          onPress={() => navigate("/(app)/settings")}
        />

        <MenuDivider />

        <MenuItem
          icon="cafe-outline"
          label="Buy Me a Coffee"
          onPress={() => openLink("https://buymeacoffee.com/musclequest")}
          hint="Opens in your browser"
        />
        <MenuItem
          icon="logo-instagram"
          label="Instagram"
          onPress={() => openLink("https://www.instagram.com/musclequest.app/")}
          hint="Opens in your browser"
        />
      </AnimatedView>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.dark.background,
    paddingLeft: 16,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.tint,
    letterSpacing: 0.3,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.cardBackground,
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuItemIcon: {
    marginRight: 14,
    width: 24,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
  },
});
