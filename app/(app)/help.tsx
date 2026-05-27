import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { HELP_DATA } from "@/constants/HelpData";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

function highlightTokens(
  text: string,
  tokens: string[],
  highlightColor: string,
) {
  if (tokens.length === 0) return <Text>{text}</Text>;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <Text>
      {parts.map((part, i) =>
        tokens.some((t) => part.toLowerCase() === t.toLowerCase()) ? (
          <Text key={i} style={{ color: highlightColor, fontWeight: "600" }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function GroupHeader({ label }: { label: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.groupHeader}>
      <Text style={styles.groupHeaderText}>{label}</Text>
    </View>
  );
}

type SectionProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: React.ReactNode;
  body: React.ReactNode;
};

function Section({ icon, title, body }: SectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name={icon}
          size={20}
          color={colors.accent}
          style={styles.sectionIcon}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export default function HelpScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const { _ } = useLingui();

  const translatedHelpData = useMemo(
    () =>
      HELP_DATA.map((group) => ({
        ...group,
        group: _(group.group),
        sections: group.sections.map((s) => ({
          ...s,
          title: _(s.title),
          body: _(s.body),
        })),
      })),
    [_],
  );

  const tokens = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );

  const filtered = useMemo(() => {
    if (tokens.length === 0) return translatedHelpData;
    return translatedHelpData
      .map((group) => ({
        ...group,
        sections: group.sections.filter((s) => {
          const combined = `${group.group} ${s.title} ${s.body}`.toLowerCase();
          return tokens.every((t) => combined.includes(t));
        }),
      }))
      .filter((group) => group.sections.length > 0);
  }, [tokens, translatedHelpData]);

  const isSearching = query.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.contentSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={t`Search help…`}
          placeholderTextColor={colors.contentSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          accessibilityLabel={t`Search help`}
          accessibilityHint={t`Type to filter help topics`}
        />
        {isSearching && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            hitSlop={8}
            accessibilityLabel={t`Clear search`}
            accessibilityRole="button"
            accessibilityHint={t`Clears the search field`}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.contentSecondary}
              style={styles.clearIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isSearching && (
          <>
            <Text style={styles.intro}>
              <Trans>
                Welcome to MuscleQuest, your personal strength training
                companion. Use this guide to discover the features and get the
                most from your training.
              </Trans>
            </Text>
            <Divider style={styles.topDivider} />
          </>
        )}

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              <Trans>No results for "{query}"</Trans>
            </Text>
          </View>
        ) : (
          filtered.map((group) => (
            <View key={group.group}>
              <GroupHeader label={group.group} />
              {group.sections.map((section, i) => (
                <View key={`${group.group}:${section.title}`}>
                  <Section
                    icon={section.icon}
                    title={highlightTokens(
                      section.title,
                      isSearching ? tokens : [],
                      colors.accent,
                    )}
                    body={highlightTokens(
                      section.body,
                      isSearching ? tokens : [],
                      colors.accent,
                    )}
                  />
                  {i < group.sections.length - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </View>
              ))}
            </View>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 10,
    },
    searchIcon: {
      marginRight: 6,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.contentPrimary,
    },
    clearIcon: {
      marginLeft: 6,
    },
    scrollContent: {
      padding: 20,
      paddingTop: 12,
    },
    intro: {
      fontSize: 15,
      color: colors.contentSecondary,
      lineHeight: 22,
      marginBottom: 16,
    },
    topDivider: {
      backgroundColor: colors.card,
      marginBottom: 16,
    },
    groupHeader: {
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    groupHeaderText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.contentSecondary,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    section: {
      marginBottom: 4,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionIcon: {
      marginRight: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    sectionBody: {
      fontSize: 14,
      color: colors.contentSecondary,
      lineHeight: 21,
      paddingLeft: 30,
    },
    divider: {
      backgroundColor: colors.card,
      marginVertical: 16,
    },
    emptyState: {
      marginTop: 60,
      alignItems: "center",
    },
    emptyStateText: {
      fontSize: 15,
      color: colors.contentSecondary,
    },
    bottomPadding: {
      height: 32,
    },
  });
}
