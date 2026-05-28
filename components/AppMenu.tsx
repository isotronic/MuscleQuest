import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { t } from "@lingui/core/macro";
import { useMenuStore } from "@/store/menuStore";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createMenuItemStyles(colors), [colors]);
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
        color={colors.accent}
        style={styles.menuItemIcon}
      />
      <Text style={styles.menuItemLabel}>{label}</Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.contentSecondary}
      />
    </TouchableOpacity>
  );
}

function MenuDivider() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createMenuItemStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

export function AppMenu() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          accessibilityLabel={t`Close menu`}
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
            accessibilityLabel={t`Close menu`}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={colors.contentPrimary} />
          </TouchableOpacity>
        </View>

        <MenuDivider />

        <MenuItem
          icon="barbell-outline"
          label={t`Exercise Library`}
          onPress={() => navigate("/(app)/exercise-library")}
        />
        <MenuItem
          icon="settings-outline"
          label={t`Settings`}
          onPress={() => navigate("/(app)/settings")}
        />
        <MenuItem
          icon="help-circle-outline"
          label={t`Help & Info`}
          onPress={() => navigate("/(app)/help")}
        />

        <MenuDivider />

        <MenuItem
          icon="cafe-outline"
          label={t`Buy Me a Coffee`}
          onPress={() => openLink("https://buymeacoffee.com/musclequest")}
          hint={t`Opens in your browser`}
        />
        <MenuItem
          icon="logo-instagram"
          label={t`MuscleQuest's Instagram`}
          onPress={() => openLink("https://www.instagram.com/musclequest.app/")}
          hint={t`Opens in your browser`}
        />
      </AnimatedView>
    </Portal>
  );
}

function createMenuItemStyles(colors: AppThemeColors) {
  return StyleSheet.create({
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
      color: colors.contentPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.card,
      marginVertical: 8,
    },
  });
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: colors.modalBackdrop,
    },
    panel: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
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
      color: colors.accent,
      letterSpacing: 0.3,
    },
    closeButton: {
      padding: 4,
    },
  });
}
