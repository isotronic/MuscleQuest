import { useContext, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Divider } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { AppIcon } from "@/components/ui/AppIcon";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AccountCard } from "@/components/settings/AccountCard";
import { AuthContext } from "@/context/AuthProvider";
import { useBottomScrollPadding } from "@/hooks/useBottomScrollPadding";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { SettingRow, useSettingStyles } from "@/components/settings/SettingRow";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import {
  buildSettingsSearch,
  searchSettings,
  settingTarget,
  SETTINGS_SCREENS,
  translateSettingsIndex,
  type SettingsSearchDoc,
} from "@/utils/settingsIndex";

const openScreen = (screen: string, highlight?: string) =>
  router.push({
    pathname: `/(app)/settings/${screen}` as never,
    params: highlight ? { highlight } : {},
  });

/**
 * The settings root: the account, a search over every setting, then one row
 * per topic screen.
 */
export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rowStyles = useSettingStyles();
  const bottomPadding = useBottomScrollPadding(16);
  const { _, i18n } = useLingui();
  // "progression" opened this screen at that section before it had its own.
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [query, setQuery] = useState("");
  const user = useContext(AuthContext);
  const { data: settings } = useSettingsQuery();
  const state = {
    signedIn: !!user,
    progressionOn: settings?.adaptive_progression_enabled === "1",
  };

  const index = useMemo(
    () => buildSettingsSearch(translateSettingsIndex((d) => i18n._(d))),
    [i18n],
  );
  const results = useMemo(() => searchSettings(index, query), [index, query]);

  if (section === "progression") {
    return <Redirect href="/(app)/settings/progression" />;
  }

  const renderResult = (doc: SettingsSearchDoc) => (
    <TouchableOpacity
      key={doc.id}
      accessibilityRole="button"
      testID={`settings-result-${doc.id}`}
      style={styles.result}
      onPress={() => openScreen(doc.screen, settingTarget(doc.id, state))}
    >
      <ThemedText style={rowStyles.itemText}>{doc.title}</ThemedText>
      <ThemedText style={rowStyles.currentSetting}>
        {doc.screenTitle}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={rowStyles.screen}>
      <ScrollView
        contentContainerStyle={[
          rowStyles.container,
          { paddingBottom: bottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AccountCard />
        <View style={styles.searchContainer}>
          <AppIcon
            set="mci"
            name="magnify"
            size={20}
            color={colors.contentSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t`Search settings…`}
            placeholderTextColor={colors.contentSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={t`Search settings`}
            testID="settings-search"
          />
          {query !== "" && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t`Clear search`}
            >
              <AppIcon
                set="mci"
                name="close-circle"
                size={18}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
        {query.trim() !== "" ? (
          results.length > 0 ? (
            results.map(renderResult)
          ) : (
            <ThemedText style={styles.empty}>
              <Trans>No settings match “{query}”.</Trans>
            </ThemedText>
          )
        ) : (
          <>
            <Divider style={rowStyles.divider} />
            {SETTINGS_SCREENS.map((screen) => (
              <SettingRow
                key={screen.id}
                icon={screen.icon}
                title={_(screen.title)}
                testID={`settings-${screen.id}`}
                onPress={() => openScreen(screen.id)}
                trailing={
                  <AppIcon
                    set="mci"
                    name="chevron-right"
                    size={24}
                    color={colors.contentSecondary}
                  />
                }
              />
            ))}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingHorizontal: 10,
      marginVertical: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.contentPrimary,
    },
    result: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.contentSecondary,
    },
    empty: {
      color: colors.contentSecondary,
      paddingVertical: 16,
    },
  });
}
