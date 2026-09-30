import React, { useMemo } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { Checkbox } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { AppImage, checkboxLabel } from "@/components/ui";
import { capitalizeWords } from "@/utils/utility";
import { Exercise } from "@/utils/database";
import { useLingui } from "@lingui/react";
import { t } from "@lingui/core/macro";
import {
  bodyPartTranslations,
  equipmentTranslations,
} from "@/constants/dbTranslations";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const fallbackImage = require("@/assets/images/placeholder.webp");

interface ExerciseItemProps {
  item: Exercise;
  selected: boolean;
  onSelect: (id: number) => void;
  onPress: (item: Exercise) => void;
  showCheckbox?: boolean;
}

const ExerciseItem = ({
  item,
  selected,
  onSelect,
  onPress,
  showCheckbox = true,
}: ExerciseItemProps) => {
  const { _ } = useLingui();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const base64Image = useMemo(
    () =>
      item.image
        ? `data:image/webp;base64,${btoa(String.fromCharCode(...new Uint8Array(item.image)))}`
        : null,
    [item.image],
  );

  const bodyPartLabel = bodyPartTranslations[item.body_part]
    ? _(bodyPartTranslations[item.body_part])
    : capitalizeWords(item.body_part);
  const equipmentLabel = equipmentTranslations[item.equipment]
    ? _(equipmentTranslations[item.equipment])
    : capitalizeWords(item.equipment);

  // The row and the checkbox are siblings so a screen reader can reach both;
  // a checkbox nested inside an accessible row is merged away on iOS.
  return (
    <View key={item.exercise_id} style={styles.exerciseItem}>
      <TouchableOpacity
        onPress={() => onPress(item)}
        style={styles.exerciseRow}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${bodyPartLabel}, ${equipmentLabel}`}
      >
        {base64Image ? (
          <AppImage
            style={styles.exerciseImage}
            source={{ uri: base64Image }}
          />
        ) : (
          <AppImage style={styles.exerciseImage} source={fallbackImage} />
        )}
        <View style={styles.exerciseInfo}>
          <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
          <ThemedText style={styles.exerciseDetails}>
            {bodyPartLabel} | {equipmentLabel}
          </ThemedText>
        </View>
      </TouchableOpacity>
      {showCheckbox && (
        <Checkbox
          status={selected ? "checked" : "unchecked"}
          uncheckedColor={colors.contentSecondary}
          onPress={() => onSelect(item.exercise_id)}
          {...checkboxLabel(t`Select ${item.name}`)}
        />
      )}
    </View>
  );
};

export default React.memo(ExerciseItem);

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    exerciseItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: radii.md,
      marginBottom: 12,
    },
    exerciseRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    exerciseImage: {
      width: 60,
      height: 60,
      borderRadius: radii.md,
    },
    exerciseInfo: {
      marginLeft: 12,
      flex: 1,
    },
    exerciseName: {
      fontSize: 18,
      color: colors.contentPrimary,
      flexWrap: "wrap",
      flexShrink: 1,
    },
    exerciseDetails: {
      fontSize: 14,
      color: colors.contentSecondary,
    },
  });
}
