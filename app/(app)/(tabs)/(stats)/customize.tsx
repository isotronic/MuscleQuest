import { useCallback, useMemo } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import Sortable from "react-native-sortables";
import { Button, Switch } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { WIDGETS } from "@/components/stats/widgets/registry";
import {
  useStatsLayout,
  useUpdateStatsLayoutMutation,
} from "@/hooks/useStatsLayout";
import {
  defaultStatsLayout,
  moveWidget,
  setWidgetVisible,
  type StatsWidget,
} from "@/utils/statsLayout";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export default function CustomizeStatsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const router = useRouter();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { layout } = useStatsLayout();
  const { save } = useUpdateStatsLayoutMutation();

  const move = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        toIndex < 0 ||
        toIndex >= layout.widgets.length
      ) {
        return;
      }
      save(moveWidget(layout, fromIndex, toIndex));
    },
    [layout, save],
  );

  const handleReset = () =>
    Alert.alert(
      t`Reset stats layout?`,
      t`All sections are shown again in their original order with their original settings.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Reset`,
          style: "destructive",
          onPress: () => save(defaultStatsLayout()),
        },
      ],
    );

  const renderItem = useCallback(
    ({ item, index }: { item: StatsWidget; index: number }) => {
      const definition = WIDGETS[item.id];
      const title = _(definition.title);
      const hasSettings = definition.fields.length > 0;
      return (
        <View style={styles.row}>
          <Sortable.Handle>
            <View
              style={styles.handle}
              accessible
              accessibilityLabel={t`Reorder ${title}`}
              accessibilityHint={t`Use the actions to move this section up or down`}
              accessibilityActions={[
                { name: "moveUp", label: t`Move up` },
                { name: "moveDown", label: t`Move down` },
              ]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (nativeEvent.actionName === "moveUp") move(index, index - 1);
                if (nativeEvent.actionName === "moveDown")
                  move(index, index + 1);
              }}
            >
              <AppIcon
                set="mci"
                name="drag"
                size={24}
                color={colors.contentSecondary}
              />
            </View>
          </Sortable.Handle>
          <View style={styles.text}>
            <ThemedText
              style={[styles.title, !item.visible && styles.hiddenTitle]}
            >
              {title}
            </ThemedText>
            <ThemedText style={styles.description} numberOfLines={2}>
              {_(definition.description)}
            </ThemedText>
          </View>
          {hasSettings && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t`${title} settings`}
              onPress={() =>
                router.push({
                  pathname: "/(app)/(tabs)/(stats)/customize-widget",
                  params: { id: item.id },
                } as never)
              }
              style={styles.gear}
              hitSlop={8}
            >
              <AppIcon
                set="mci"
                name="cog-outline"
                size={22}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          )}
          <Switch
            accessibilityLabel={t`Show ${title}`}
            value={item.visible}
            onValueChange={(visible) =>
              save(setWidgetVisible(layout, item.id, visible))
            }
            color={colors.accent}
          />
        </View>
      );
    },
    [_, colors, layout, move, router, save, styles],
  );

  return (
    <ThemedView style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
      >
        <ThemedText style={styles.intro}>
          <Trans>
            Drag to reorder, switch sections on or off, and tap the gear to
            change what a section shows.
          </Trans>
        </ThemedText>
        <Sortable.Grid
          columns={1}
          data={layout.widgets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ fromIndex, toIndex }) => move(fromIndex, toIndex)}
          customHandle
          scrollableRef={scrollRef}
          showDropIndicator
          rowGap={8}
        />
        <Button
          mode="text"
          textColor={colors.contentSecondary}
          onPress={handleReset}
          style={styles.reset}
        >
          <Trans>Reset to default</Trans>
        </Button>
      </Animated.ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 48,
    },
    intro: {
      fontSize: 13,
      color: colors.contentSecondary,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingRight: 8,
    },
    handle: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    text: {
      flex: 1,
      marginRight: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: "bold",
    },
    hiddenTitle: {
      color: colors.contentSecondary,
    },
    description: {
      fontSize: 12,
      color: colors.contentSecondary,
      marginTop: 2,
    },
    gear: {
      padding: 6,
    },
    reset: {
      marginTop: 16,
      alignSelf: "center",
    },
  });
}
