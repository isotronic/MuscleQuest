import React, { useMemo, useRef, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { HELP_DATA, isStepsBody } from "@/constants/HelpData";
import { AppIcon } from "@/components/ui";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useHelpSearch } from "@/hooks/useHelpSearch";
import {
  TranslatedBody,
  SectionMatch,
  TextSegment,
  extractSnippet,
  flattenBody,
  isTranslatedStepsBody,
  toSegments,
  stepLocalHighlightRanges,
} from "@/utils/helpSearch";

type ScrollViewType = typeof ScrollView;

const FEATURE_REQUEST_URL = "https://www.featurize.io/p/musclequest";

function renderSegments(segments: TextSegment[], highlightColor: string) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <Text key={i} style={{ color: highlightColor, fontWeight: "600" }}>
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </>
  );
}

function GroupChipsRow({
  groups,
  onPress,
}: {
  groups: { id: string; label: string }[];
  onPress: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.chipsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipsContent}
      >
        {groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            testID={`help-chip-${group.id}`}
            style={styles.chip}
            onPress={() => onPress(group.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipText}>{group.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function GroupHeader({
  id,
  label,
  isOpen,
  onToggle,
}: {
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      testID={`help-group-header-${id}`}
      style={styles.groupHeader}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
    >
      <Text style={styles.groupHeaderText}>{label}</Text>
      <AppIcon
        set="ion"
        name={isOpen ? "chevron-up" : "chevron-down"}
        size={16}
        color={colors.contentSecondary}
      />
    </TouchableOpacity>
  );
}

type SectionProps = {
  icon: Extract<React.ComponentProps<typeof AppIcon>, { set: "ion" }>["name"];
  title: React.ReactNode;
  children: React.ReactNode;
};

function Section({ icon, title, children }: SectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppIcon
          set="ion"
          name={icon}
          size={20}
          color={colors.accent}
          style={styles.sectionIcon}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StepsList({
  steps,
  ordered,
}: {
  steps: React.ReactNode[];
  ordered: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.stepsList}>
      {steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepMarker}>{ordered ? `${i + 1}.` : "•"}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function BrowseBody({ body }: { body: TranslatedBody }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (typeof body === "string") {
    return <Text style={styles.bodyText}>{body}</Text>;
  }
  return (
    <View>
      <Text style={styles.bodyText}>{body.lead}</Text>
      <StepsList steps={body.steps} ordered={body.ordered} />
    </View>
  );
}

function SearchBody({
  body,
  match,
  expanded,
  onToggleExpand,
  highlightColor,
}: {
  body: TranslatedBody;
  match: SectionMatch;
  expanded: boolean;
  onToggleExpand: () => void;
  highlightColor: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (expanded) {
    return <BrowseBody body={body} />;
  }

  if (isTranslatedStepsBody(body)) {
    const { stepRanges } = flattenBody(body);
    const matchedIdx = match.matchedStepIndices;

    if (matchedIdx.length === 0 || !stepRanges) {
      return (
        <View>
          <Text style={styles.bodyText}>{body.lead}</Text>
          <TouchableOpacity onPress={onToggleExpand} hitSlop={8}>
            <Text style={styles.showMore}>
              <Trans>{body.steps.length} steps — tap to view</Trans>
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const shown = matchedIdx.slice(0, 2);
    const remaining = body.steps.length - shown.length;
    return (
      <View>
        <Text style={styles.bodyText}>{body.lead}</Text>
        <StepsList
          ordered={body.ordered}
          steps={shown.map((i) => {
            const localRanges = stepLocalHighlightRanges(
              stepRanges[i],
              match.bodyRanges,
            );
            const segments = toSegments(body.steps[i], localRanges);
            return renderSegments(segments, highlightColor);
          })}
        />
        <TouchableOpacity onPress={onToggleExpand} hitSlop={8}>
          <Text style={styles.showMore}>
            {remaining > 0 ? (
              <Trans>+{remaining} more steps</Trans>
            ) : (
              <Trans>Show details</Trans>
            )}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const flat = flattenBody(body).text;
  const snippet = extractSnippet(flat, match.bodyRanges, 100);
  const segments = toSegments(snippet.text, snippet.ranges);
  const truncated = snippet.text !== flat;
  return (
    <View>
      <Text style={styles.bodyText}>
        {renderSegments(segments, highlightColor)}
      </Text>
      {truncated && (
        <TouchableOpacity onPress={onToggleExpand} hitSlop={8}>
          <Text style={styles.showMore}>
            <Trans>Show more</Trans>
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const scrollRef = useRef<ScrollViewType>(null);
  const groupOffsets = useRef<Record<string, number>>({});
  const { _ } = useLingui();

  const translatedHelpData = useMemo(
    () =>
      HELP_DATA.map((group) => ({
        ...group,
        group: _(group.group),
        sections: group.sections.map((s) => ({
          ...s,
          title: _(s.title),
          body: (isStepsBody(s.body)
            ? {
                lead: _(s.body.lead),
                steps: s.body.steps.map((step) => _(step)),
                ordered: s.body.ordered ?? true,
              }
            : _(s.body)) as TranslatedBody,
        })),
      })),
    [_],
  );

  const isSearching = query.trim().length > 0;
  const { matches, matchedGroupIds } = useHelpSearch(translatedHelpData, query);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setExpandedSections(new Set());
  };

  const toggleGroup = (id: string) => {
    if (isSearching) return;
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSectionExpanded = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupsToRender = useMemo(() => {
    if (!isSearching) return translatedHelpData;
    return translatedHelpData
      .filter((group) => matchedGroupIds.has(group.id))
      .map((group) => ({
        ...group,
        sections: group.sections.filter((s) => matches.has(s.id)),
      }));
  }, [isSearching, translatedHelpData, matchedGroupIds, matches]);

  const scrollToGroup = (id: string) => {
    const y = groupOffsets.current[id];
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <AppIcon
          set="ion"
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
          onChangeText={handleQueryChange}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          accessibilityLabel={t`Search help`}
          accessibilityHint={t`Type to filter help topics`}
        />
        {isSearching && (
          <TouchableOpacity
            onPress={() => handleQueryChange("")}
            hitSlop={8}
            accessibilityLabel={t`Clear search`}
            accessibilityRole="button"
            accessibilityHint={t`Clears the search field`}
          >
            <AppIcon
              set="ion"
              name="close-circle"
              size={18}
              color={colors.contentSecondary}
              style={styles.clearIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      {!isSearching && (
        <GroupChipsRow
          groups={translatedHelpData.map((g) => ({
            id: g.id,
            label: g.group,
          }))}
          onPress={scrollToGroup}
        />
      )}

      <ScrollView
        ref={scrollRef}
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

        {isSearching && groupsToRender.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              <Trans>No results for "{query}"</Trans>
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => handleQueryChange("")}
            >
              <Text style={styles.emptyButtonText}>
                <Trans>Clear search</Trans>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptyLinkButton}
              onPress={() => Linking.openURL(FEATURE_REQUEST_URL)}
            >
              <AppIcon set="mci" name="vote" size={16} color={colors.accent} />
              <Text style={styles.emptyLinkText}>
                <Trans>Didn't find what you were looking for? Request it</Trans>
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          groupsToRender.map((group) => {
            const isOpen = isSearching || openGroups.has(group.id);
            return (
              <View
                key={group.id}
                testID={`help-group-${group.id}`}
                onLayout={(e: { nativeEvent: { layout: { y: number } } }) => {
                  groupOffsets.current[group.id] = e.nativeEvent.layout.y;
                }}
              >
                <GroupHeader
                  id={group.id}
                  label={group.group}
                  isOpen={isOpen}
                  onToggle={() => toggleGroup(group.id)}
                />
                {isOpen &&
                  group.sections.map((section, i) => {
                    const match = matches.get(section.id);
                    return (
                      <View key={section.id}>
                        <Section
                          icon={section.icon}
                          title={
                            isSearching && match
                              ? renderSegments(
                                  toSegments(section.title, match.titleRanges),
                                  colors.accent,
                                )
                              : section.title
                          }
                        >
                          {isSearching && match ? (
                            <SearchBody
                              body={section.body}
                              match={match}
                              expanded={expandedSections.has(section.id)}
                              onToggleExpand={() =>
                                toggleSectionExpanded(section.id)
                              }
                              highlightColor={colors.accent}
                            />
                          ) : (
                            <BrowseBody body={section.body} />
                          )}
                        </Section>
                        {i < group.sections.length - 1 && (
                          <Divider style={styles.divider} />
                        )}
                      </View>
                    );
                  })}
              </View>
            );
          })
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
    chipsContainer: {
      paddingBottom: 4,
    },
    chipsContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    chip: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    chipText: {
      color: colors.contentPrimary,
      fontSize: 13,
      fontWeight: "500",
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 24,
      marginBottom: 8,
      paddingVertical: 6,
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
      paddingLeft: 30,
    },
    bodyText: {
      fontSize: 14,
      color: colors.contentSecondary,
      lineHeight: 21,
    },
    stepsList: {
      marginTop: 8,
      gap: 6,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    stepMarker: {
      fontSize: 14,
      color: colors.contentSecondary,
      fontWeight: "600",
      minWidth: 18,
    },
    stepText: {
      flex: 1,
      fontSize: 14,
      color: colors.contentSecondary,
      lineHeight: 21,
    },
    showMore: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    divider: {
      backgroundColor: colors.card,
      marginVertical: 16,
    },
    emptyState: {
      marginTop: 60,
      alignItems: "center",
      paddingHorizontal: 24,
      gap: 16,
    },
    emptyStateText: {
      fontSize: 15,
      color: colors.contentSecondary,
      textAlign: "center",
    },
    emptyButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: radii.xl,
      backgroundColor: colors.card,
    },
    emptyButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    emptyLinkButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    emptyLinkText: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: "500",
      textAlign: "center",
    },
    bottomPadding: {
      height: 32,
    },
  });
}
