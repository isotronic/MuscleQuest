import React, { useRef } from "react";
import { t } from "@lingui/core/macro";
import { Button } from "react-native-paper";
import { AppIconButton } from "@/components/ui";
import { useNotes, NoteType } from "@/hooks/useNotes";
import { NoteSheet, type NoteSheetHandle } from "@/components/NoteSheet";
import { useAppTheme } from "@/theme";

interface CuesProps {
  noteType: NoteType;
  referenceId: number;
  secondaryReferenceId?: number;
  buttonType: "icon" | "button";
}

const sheetText = (noteType: NoteType) => {
  switch (noteType) {
    case "plan":
      return {
        title: t`Plan cues`,
        placeholder: t`Reminders for this plan`,
      };
    case "workout":
      return {
        title: t`Workout cues`,
        placeholder: t`Reminders for this workout`,
      };
    default:
      return {
        title: t`Exercise cues`,
        placeholder: t`Form cues and reminders for this exercise`,
      };
  }
};

/**
 * Standing reminders on a plan, workout or exercise (the notes table). A note
 * on one session or one set is something else; see NoteSheet.
 */
export const Cues: React.FC<CuesProps> = ({
  noteType,
  referenceId,
  secondaryReferenceId,
  buttonType,
}) => {
  const { colors } = useAppTheme();
  const sheetRef = useRef<NoteSheetHandle>(null);
  const { note, saveNote } = useNotes(
    noteType,
    referenceId,
    secondaryReferenceId,
  );
  const hasCues = !!note.trim();
  const { title, placeholder } = sheetText(noteType);
  const open = () => sheetRef.current?.open(note);

  return (
    <>
      {buttonType === "icon" && (
        <AppIconButton
          accessibilityLabel={hasCues ? t`Edit cues` : t`Add cues`}
          onPressIn={open}
          icon={hasCues ? "lightbulb-on" : "lightbulb-on-outline"}
          size={25}
          iconColor={hasCues ? colors.accent : colors.contentPrimary}
          style={{ margin: 0 }}
        />
      )}
      {buttonType === "button" && (
        <Button
          icon={hasCues ? "lightbulb-on" : "lightbulb-on-outline"}
          onPressIn={open}
          mode="outlined"
          compact
        >
          {hasCues ? t`Cues` : t`Add cues`}
        </Button>
      )}
      <NoteSheet
        ref={sheetRef}
        title={title}
        placeholder={placeholder}
        onSave={saveNote}
      />
    </>
  );
};
