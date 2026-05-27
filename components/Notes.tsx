import React, { useRef, useState, useCallback } from "react";
import { View, TouchableOpacity, TextInput as RNTextInput } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useNotes, NoteType } from "@/hooks/useNotes";
import { Button, Divider, IconButton } from "react-native-paper";
import { ThemedText } from "./ThemedText";
import { Pressable } from "react-native-gesture-handler";
import { capitalizeWords } from "@/utils/utility";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { useAppTheme } from "@/theme";

const NoteInput = BottomSheetTextInput as unknown as React.ComponentType<
  React.ComponentPropsWithoutRef<typeof RNTextInput> & { ref?: React.Ref<any> }
>;

interface NotesProps {
  noteType: NoteType;
  referenceId: number;
  secondaryReferenceId?: number;
  buttonType: "icon" | "button";
}

export const Notes: React.FC<NotesProps> = ({
  noteType,
  referenceId,
  secondaryReferenceId,
  buttonType,
}) => {
  const { colors } = useAppTheme();
  const bottomSheetRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  // Refs track the live text without triggering re-renders on each keystroke
  const currentNoteRef = useRef("");
  const initialNoteRef = useRef("");
  const [inputKey, setInputKey] = useState(0);

  const { note, saveNote } = useNotes(
    noteType,
    referenceId,
    secondaryReferenceId,
  );

  const handleOpen = () => {
    currentNoteRef.current = note;
    initialNoteRef.current = note;
    setInputKey((k) => k + 1);
    bottomSheetRef.current?.present();
  };

  const handleClose = () => {
    bottomSheetRef.current?.dismiss();
  };

  const handleSaveOnClose = useCallback(() => {
    if (currentNoteRef.current.trim() !== initialNoteRef.current.trim()) {
      saveNote(currentNoteRef.current.trim());
    }
  }, [saveNote]);

  return (
    <>
      {/* Open Button */}
      {buttonType === "icon" && (
        <IconButton
          onPressIn={handleOpen}
          icon="note-edit"
          size={25}
          iconColor={note.trim() ? colors.accent : colors.contentPrimary}
          style={{ margin: 0 }}
        />
      )}
      {buttonType === "button" && (
        <Button
          icon={note.trim() ? "note-edit" : "note-outline"}
          onPressIn={handleOpen}
          mode="outlined"
          compact
          style={{ marginBottom: 16 }}
        >
          <Trans>{note.trim() ? t`View/Edit` : t`Add`} Note</Trans>
        </Button>
      )}

      {/* Bottom Sheet */}
      <AppBottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={["45%"]}
        enablePanDownToClose
        onDismiss={handleSaveOnClose}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} />
        )}
      >
        <BottomSheetView>
          <View
            style={{ flexDirection: "row", paddingHorizontal: 16, gap: 12 }}
          >
            {/* Header with close arrow */}
            <TouchableOpacity
              onPress={handleClose}
              style={{ alignSelf: "flex-start" }}
            >
              <MaterialCommunityIcons
                name="chevron-down"
                size={28}
                color={colors.contentPrimary}
              />
            </TouchableOpacity>
            <ThemedText style={{ fontSize: 20 }}>
              <Trans>{capitalizeWords(noteType)} Notes</Trans>
            </ThemedText>
          </View>
          <Divider style={{ marginTop: 8, marginBottom: 16 }} />
          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={{ flex: 1 }}
          >
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <NoteInput
                key={inputKey}
                ref={inputRef}
                defaultValue={currentNoteRef.current}
                onChangeText={(text: string) => {
                  currentNoteRef.current = text;
                }}
                placeholder={t`Add a note...`}
                placeholderTextColor={colors.contentSecondary}
                multiline
                maxLength={500}
                style={{
                  fontSize: 16,
                  color: colors.contentPrimary,
                  minHeight: 120,
                  textAlignVertical: "top",
                }}
              />
            </View>
          </Pressable>
        </BottomSheetView>
      </AppBottomSheet>
    </>
  );
};
