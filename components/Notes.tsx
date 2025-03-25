import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, TouchableOpacity, TextInput } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNotes, NoteType } from "@/hooks/useNotes";
import { Colors } from "@/constants/Colors";
import { Button, Divider, IconButton } from "react-native-paper";
import { ThemedText } from "./ThemedText";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";

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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [localNote, setLocalNote] = useState("");
  const [initialNote, setInitialNote] = useState("");
  const inputRef = useRef<typeof TextInput>(null);

  const { note, saveNote } = useNotes(
    noteType,
    referenceId,
    secondaryReferenceId,
  );

  // Sync Tanstack note into local state
  useEffect(() => {
    setLocalNote(note);
    setInitialNote(note);
  }, [note]);

  const handleOpen = () => {
    bottomSheetRef.current?.present();
  };

  const handleClose = () => {
    bottomSheetRef.current?.dismiss();
  };

  const handleSaveOnClose = useCallback(() => {
    if (localNote.trim() !== initialNote.trim()) {
      saveNote(localNote.trim());
    }
  }, [localNote, initialNote, saveNote]);

  return (
    <>
      {/* Open Button */}
      {buttonType === "icon" && (
        <IconButton
          onPress={handleOpen}
          icon="note-edit"
          size={25}
          iconColor={note.trim() ? Colors.dark.tint : Colors.dark.text}
          style={{ margin: 0 }}
        />
      )}
      {buttonType === "button" && (
        <Button
          icon={note.trim() ? "note-edit" : "note-outline"}
          onPress={handleOpen}
          mode="outlined"
          compact
        >
          {note.trim() ? "Edit" : "Add"} Note
        </Button>
      )}

      {/* Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetRef}
        index={0}
        snapPoints={["45%"]}
        enablePanDownToClose
        onDismiss={handleSaveOnClose}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} />
        )}
        backgroundStyle={{ backgroundColor: Colors.dark.cardBackground }}
      >
        <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 12 }}>
          {/* Header with close arrow */}
          <TouchableOpacity
            onPress={handleClose}
            style={{ alignSelf: "flex-start" }}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={28}
              color={Colors.dark.text}
            />
          </TouchableOpacity>
          <ThemedText
            style={{
              fontSize: 20,
              color: Colors.dark.text,
            }}
          >
            Note
          </ThemedText>
        </View>
        <Divider style={{ marginTop: 8, marginBottom: 16 }} />
        <TouchableWithoutFeedback
          onPress={() => inputRef.current?.focus()}
          style={{ height: "100%" }}
        >
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {/* Editable note (no visual input style) */}
            <TextInput
              ref={inputRef}
              value={localNote}
              onChangeText={setLocalNote}
              placeholder="Add a note..."
              placeholderTextColor={Colors.dark.subText}
              multiline
              maxLength={500}
              style={{
                fontSize: 16,
                color: Colors.dark.text,
                minHeight: 120,
                textAlignVertical: "top",
              }}
            />
          </View>
        </TouchableWithoutFeedback>
      </BottomSheetModal>
    </>
  );
};
