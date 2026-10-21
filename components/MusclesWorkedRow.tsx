import React, { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import {
  buildMuscleSetsRows,
  MuscleSetBars,
  useMuscleName,
} from "@/components/MuscleSetBars";
import { useMuscleSetsSettings } from "@/hooks/useMuscleSetsSettings";
import {
  plannedMuscleSets,
  type PlannedExercise,
} from "@/utils/plannedMuscleSets";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * A collapsed row naming the muscles a workout trains most; opened, it shows
 * planned working sets per muscle. Nothing shows until an exercise has a
 * working set.
 */
export function MusclesWorkedRow({
  exercises,
  style,
}: {
  exercises: readonly PlannedExercise[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { secondaryWeight } = useMuscleSetsSettings();
  const nameOf = useMuscleName();
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () =>
      buildMuscleSetsRows(
        plannedMuscleSets(exercises, secondaryWeight),
        1,
        null,
      ),
    [exercises, secondaryWeight],
  );
  if (rows.length === 0) return null;

  const top = rows
    .slice(0, 3)
    .map((row) => nameOf(row.key))
    .join(", ");

  return (
    <View style={[styles.container, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t`Muscles worked: ${top}`}
        onPress={() => setOpen((value) => !value)}
        style={styles.header}
        hitSlop={8}
      >
        <AppIcon
          set="ion"
          name={open ? "chevron-down" : "chevron-forward-outline"}
          size={14}
          color={colors.contentSecondary}
        />
        <ThemedText style={styles.headerText} numberOfLines={1}>
          <Trans>Muscles worked: {top}</Trans>
        </ThemedText>
      </Pressable>
      {open && (
        <View style={styles.body}>
          <MuscleSetBars
            rows={rows}
            target={null}
            nameOf={nameOf}
            rowLabel={(name, sets) => t`${name}, ${sets} sets`}
          />
          <ThemedText style={styles.footnote}>
            {secondaryWeight > 0
              ? t`Planned working sets. Secondary muscles count as half a set.`
              : t`Planned working sets.`}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    headerText: {
      flex: 1,
      fontSize: 13,
      color: colors.contentSecondary,
    },
    body: {
      gap: 8,
      marginTop: 8,
      marginBottom: 4,
    },
    footnote: {
      fontSize: 11,
      color: colors.contentSecondary,
    },
  });
}
