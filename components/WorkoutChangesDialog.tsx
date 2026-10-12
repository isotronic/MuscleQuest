import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Modal, Portal } from "react-native-paper";
import { t, plural } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui/AppIcon";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { formatGroupedInteger } from "@/utils/numberFormat";
import type { ExerciseDetail, WorkoutChange } from "@/utils/workoutChanges";

function detailText(detail: ExerciseDetail): string {
  switch (detail.kind) {
    case "setCount": {
      const from = formatGroupedInteger(detail.from);
      return plural(detail.to, {
        one: `${from} → # set`,
        other: `${from} → # sets`,
      });
    }
    case "targets":
      return t`New targets`;
    case "rest":
      return t`New rest times`;
    case "setTypes":
      return t`New set types`;
    case "tracking":
      return t`New tracking type`;
    case "superset":
      return t`Superset changed`;
  }
}

const detailsText = (details: ExerciseDetail[]) =>
  details.map(detailText).join(", ");

/** A row's two lines: what it is about, and what happened to it. */
export function describeChange(change: WorkoutChange): {
  title: string;
  subtitle: string;
} {
  switch (change.kind) {
    case "added": {
      const partner = change.supersetWith;
      return {
        title: change.name,
        subtitle: partner ? t`Added, in a superset with ${partner}` : t`Added`,
      };
    }
    case "removed":
      return { title: change.name, subtitle: t`Removed` };
    case "swapped": {
      const { from, to } = change;
      const details = detailsText(change.details);
      return {
        title: t`${from} → ${to}`,
        subtitle: details ? t`Swapped, ${details}` : t`Swapped`,
      };
    }
    case "modified":
      return { title: change.name, subtitle: detailsText(change.details) };
    case "unlinked": {
      const pair = change.names.join(" + ");
      return { title: pair, subtitle: t`No longer a superset` };
    }
    case "reordered":
      return { title: t`Exercise order`, subtitle: t`New order` };
  }
}

interface WorkoutChangesDialogProps {
  visible: boolean;
  /** A plan's workout, or a workout outside plans. */
  isPlan: boolean;
  changes: WorkoutChange[];
  /** The chosen change ids, or null to keep the workout as it was. */
  onDone: (chosenIds: string[] | null) => void;
}

/**
 * Asks which of the session's changes to keep for future sessions. Every
 * change starts chosen, so saving straight away keeps the session as it was.
 */
export function WorkoutChangesDialog({
  visible,
  isPlan,
  changes,
  onDone,
}: WorkoutChangesDialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setChosen(new Set(changes.map((c) => c.id)));
  }, [visible, changes]);

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => onDone(null)}
        contentContainerStyle={styles.modal}
        theme={{ colors: { backdrop: colors.modalBackdrop } }}
      >
        <ThemedText accessibilityRole="header" style={styles.title}>
          {isPlan ? t`Update your plan?` : t`Update this workout?`}
        </ThemedText>
        <ThemedText style={styles.message}>
          <Trans>Choose the changes to keep for future sessions.</Trans>
        </ThemedText>
        <ScrollView style={styles.list}>
          {changes.map((change) => {
            const { title, subtitle } = describeChange(change);
            const checked = chosen.has(change.id);
            return (
              <Pressable
                key={change.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
                onPress={() => toggle(change.id)}
                style={styles.row}
              >
                <AppIcon
                  set="mci"
                  name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={24}
                  color={checked ? colors.accent : colors.contentSecondary}
                />
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>{title}</ThemedText>
                  {subtitle ? (
                    <ThemedText style={styles.rowSubtitle}>
                      {subtitle}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.buttons}>
          <Button mode="text" onPress={() => onDone(null)}>
            {isPlan ? t`Keep plan as is` : t`Keep workout as is`}
          </Button>
          <Button
            mode="contained"
            disabled={chosen.size === 0}
            onPress={() => onDone([...chosen])}
          >
            {isPlan ? t`Update plan` : t`Update workout`}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modal: {
      backgroundColor: colors.card,
      marginHorizontal: 20,
      borderRadius: radii.lg,
      padding: 20,
      maxHeight: "80%",
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    message: {
      color: colors.contentSecondary,
      marginTop: 4,
      marginBottom: 12,
    },
    list: {
      flexGrow: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      color: colors.contentPrimary,
      fontWeight: "600",
    },
    rowSubtitle: {
      color: colors.contentSecondary,
      fontSize: 13,
    },
    buttons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
  });
}
