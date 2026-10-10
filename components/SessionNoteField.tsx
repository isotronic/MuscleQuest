import React, { useMemo, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { t } from "@lingui/core/macro";
import { Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { NoteSheet, type NoteSheetHandle } from "@/components/NoteSheet";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface SessionNoteFieldProps {
  note: string;
  onSave: (text: string) => void;
}

/**
 * The note on one session: a button to add it, or the note itself to tap and
 * edit. Session notes stay on the device; sharing never sends them.
 */
export default function SessionNoteField({
  note,
  onSave,
}: SessionNoteFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sheetRef = useRef<NoteSheetHandle>(null);
  const trimmed = note.trim();
  const open = () => sheetRef.current?.open(note);

  return (
    <View>
      {trimmed ? (
        <TouchableOpacity
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={t`Session note: ${trimmed}. Edit`}
          style={styles.noteBox}
        >
          <ThemedText style={styles.label}>{t`Session note`}</ThemedText>
          <ThemedText style={styles.noteText} numberOfLines={4}>
            {trimmed}
          </ThemedText>
        </TouchableOpacity>
      ) : (
        <Button icon="note-plus-outline" onPress={open} mode="outlined" compact>
          {t`Add session note`}
        </Button>
      )}
      <NoteSheet
        ref={sheetRef}
        title={t`Session note`}
        placeholder={t`How did it go? Sleep, energy, anything that hurt...`}
        onSave={onSave}
      />
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    noteBox: {
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    label: {
      fontSize: 12,
      color: colors.contentSecondary,
    },
    noteText: {
      fontSize: 14,
    },
  });
}
