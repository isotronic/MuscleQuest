import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Switch } from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppIcon } from "@/components/ui/AppIcon";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { SettingId } from "@/utils/settingsIndex";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// A search result opens its screen with ?highlight=<row id>; that row scrolls
// into view and flashes.
const HighlightContext = createContext<{
  highlight?: string;
  scrollTo: (y: number) => void;
}>({ scrollTo: () => {} });

/** A settings sub-screen's scroll view; rows inside can be highlighted. */
export function SettingsScroll({ children }: { children: React.ReactNode }) {
  const styles = useSettingStyles();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const value = useMemo(
    () => ({
      highlight,
      scrollTo: (y: number) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }),
    }),
    [highlight],
  );
  return (
    <ThemedView style={styles.screen}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
        <HighlightContext.Provider value={value}>
          {children}
        </HighlightContext.Provider>
      </ScrollView>
    </ThemedView>
  );
}

/** Background flash and scroll-into-view for the highlighted row. */
function useRowHighlight(id: SettingId | undefined) {
  const { colors } = useAppTheme();
  const { highlight, scrollTo } = useContext(HighlightContext);
  const active = !!id && id === highlight;
  const [flash] = useState(() => new Animated.Value(active ? 1 : 0));
  const scrolled = useRef(false);

  useEffect(() => {
    if (!active) return;
    flash.setValue(1);
    Animated.timing(flash, {
      toValue: 0,
      duration: 1600,
      delay: 600,
      useNativeDriver: false,
    }).start();
  }, [active, flash]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (!active || scrolled.current) return;
    scrolled.current = true;
    scrollTo(e.nativeEvent.layout.y);
  };
  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", colors.accentSubtle],
  });
  return { onLayout, style: active ? { backgroundColor } : undefined };
}

interface RowProps {
  /** The search index id, so a search result can find this row. */
  id?: SettingId;
  icon: IconName;
  iconColor?: string;
  title: React.ReactNode;
  titleColor?: string;
  /** The current value or a short description, under the title. */
  value?: React.ReactNode;
  /** Extra lines under the value. */
  children?: React.ReactNode;
  /** Shown at the end of the row (a switch, buttons). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One settings row: icon, title, current value; pressable when onPress. */
export function SettingRow({
  id,
  onPress,
  disabled,
  style,
  title,
  ...content
}: RowProps) {
  const styles = useSettingStyles();
  const highlight = useRowHighlight(id);
  return (
    <Animated.View onLayout={highlight.onLayout} style={highlight.style}>
      {onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={disabled ? { disabled: true } : undefined}
          disabled={disabled}
          style={[styles.item, style]}
          onPress={onPress}
        >
          <RowContent title={title} {...content} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.item, style]}>
          <RowContent title={title} {...content} />
        </View>
      )}
    </Animated.View>
  );
}

function RowContent({
  icon,
  iconColor,
  title,
  titleColor,
  value,
  children,
  trailing,
}: Omit<RowProps, "id" | "onPress" | "disabled" | "style">) {
  const { colors } = useAppTheme();
  const styles = useSettingStyles();
  return (
    <>
      <AppIcon
        set="mci"
        name={icon}
        size={24}
        color={iconColor ?? colors.contentSecondary}
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <ThemedText
          style={[styles.itemText, titleColor ? { color: titleColor } : null]}
        >
          {title}
        </ThemedText>
        {value != null && value !== "" && (
          <ThemedText style={styles.currentSetting}>{value}</ThemedText>
        )}
        {children}
      </View>
      {trailing}
    </>
  );
}

/** Makes a block that is not a SettingRow findable from search. */
export function SettingAnchor({
  id,
  children,
}: {
  id: SettingId;
  children: React.ReactNode;
}) {
  const highlight = useRowHighlight(id);
  return (
    <Animated.View onLayout={highlight.onLayout} style={highlight.style}>
      {children}
    </Animated.View>
  );
}

interface SwitchRowProps extends Omit<RowProps, "onPress" | "trailing"> {
  /** The spoken name of the switch; the title is usually the same text. */
  label: string;
  checked: boolean;
  onValueChange: (value: boolean) => void;
}

/** A settings row ending in a switch. */
export function SwitchRow({
  label,
  checked,
  onValueChange,
  disabled,
  ...row
}: SwitchRowProps) {
  const { colors } = useAppTheme();
  const styles = useSettingStyles();
  return (
    <SettingRow
      {...row}
      trailing={
        <Switch
          accessibilityLabel={label}
          value={checked}
          onValueChange={onValueChange}
          disabled={disabled}
          color={colors.accent}
          style={styles.switch}
        />
      }
    />
  );
}

/** A section title inside a settings screen. */
export function SettingsHeader({ children }: { children: React.ReactNode }) {
  const styles = useSettingStyles();
  return (
    <ThemedText accessibilityRole="header" style={styles.sectionHeader}>
      {children}
    </ThemedText>
  );
}

export function useSettingStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16 },
    sectionHeader: {
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 16,
      marginBottom: 8,
      color: colors.contentPrimary,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      justifyContent: "space-between",
    },
    textContainer: { flex: 1, marginLeft: 8 },
    itemText: { fontSize: 16, color: colors.contentPrimary },
    currentSetting: { fontSize: 14, color: colors.contentSecondary },
    icon: { marginRight: 8 },
    switch: { marginLeft: "auto" },
    divider: { marginVertical: 8 },
    progressContainer: { marginTop: 8 },
    progressText: {
      fontSize: 14,
      color: colors.contentSecondary,
      marginBottom: 4,
    },
  });
}
