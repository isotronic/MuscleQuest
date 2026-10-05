import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ThemedView } from "@/components/ThemedView";
import { AppIcon } from "@/components/ui";
import { RELEASES, WHATS_NEW_ENTRIES } from "@/constants/WhatsNew";
import {
  formatReleaseDate,
  groupEntriesByRelease,
  splitEntryMessage,
  type ReleaseGroup,
} from "@/utils/changelog";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const RELEASE_GROUPS = groupEntriesByRelease(RELEASES, WHATS_NEW_ENTRIES);

function ReleaseSection({
  group,
  isOpen,
  onToggle,
}: {
  group: ReleaseGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _, i18n } = useLingui();
  const version = group.release.version;
  const date = formatReleaseDate(group.release.date, i18n.locale);

  return (
    <View testID={`changelog-release-${version}`}>
      <TouchableOpacity
        testID={`changelog-release-header-${version}`}
        style={styles.releaseHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={styles.releaseHeaderText}>
          <Text accessibilityRole="header" style={styles.releaseTitle}>
            {t`Version ${version}`}
          </Text>
          <Text style={styles.releaseDate}>{date}</Text>
        </View>
        <AppIcon
          set="ion"
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.contentSecondary}
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.entries}>
          {group.entries.map((entry, i) => {
            const { title, body } = splitEntryMessage(_(entry.message));
            return (
              <View key={entry.version}>
                {i > 0 && <Divider style={styles.entryDivider} />}
                <Text style={styles.entryTitle}>{title}</Text>
                {body.length > 0 && (
                  <Text style={styles.entryBody}>{body}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function ChangelogScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // The latest release starts open; older ones are a tap away.
  const [openReleases, setOpenReleases] = useState<Set<string>>(
    () => new Set(RELEASE_GROUPS.slice(0, 1).map((g) => g.release.version)),
  );

  const toggleRelease = (version: string) => {
    setOpenReleases((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          <Trans>
            Everything that has changed in MuscleQuest, newest release first.
          </Trans>
        </Text>
        {RELEASE_GROUPS.map((group, i) => (
          <View key={group.release.version}>
            {i > 0 && <Divider style={styles.releaseDivider} />}
            <ReleaseSection
              group={group}
              isOpen={openReleases.has(group.release.version)}
              onToggle={() => toggleRelease(group.release.version)}
            />
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingTop: 12,
      paddingBottom: 32,
    },
    intro: {
      fontSize: 15,
      color: colors.contentSecondary,
      lineHeight: 22,
      marginBottom: 8,
    },
    releaseHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    releaseHeaderText: {
      flex: 1,
      gap: 2,
    },
    releaseTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.contentPrimary,
    },
    releaseDate: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    releaseDivider: {
      backgroundColor: colors.card,
    },
    entries: {
      paddingTop: 4,
      paddingBottom: 16,
    },
    entryDivider: {
      backgroundColor: colors.card,
      marginVertical: 14,
    },
    entryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.contentPrimary,
      marginBottom: 6,
    },
    entryBody: {
      fontSize: 14,
      color: colors.contentSecondary,
      lineHeight: 21,
    },
  });
}
