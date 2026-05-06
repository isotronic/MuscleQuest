import React, { useRef, useState, useCallback } from "react";
import { View, TouchableOpacity } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNotes, NoteType } from "@/hooks/useNotes";
import { Colors } from "@/constants/Colors";
import { Button, Divider, IconButton } from "react-native-paper";
import { ThemedText } from "./ThemedText";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { capitalizeWords } from "@/utils/utility";

// BottomSheetTextInput has a TypeScript inference issue with memo(forwardRef) —
// cast to a plain component type so TextInputProps are accepted at the call site.
const NoteInput = BottomSheetTextInput as unknown as React.ComponentType<{
  ref?: React.Ref<any>;
  value?: string;
  defaultValue?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  multiline?: boolean;
  maxLength?: number;
  style?: object;
}>;

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
          iconColor={note.trim() ? Colors.dark.tint : Colors.dark.text}
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
          {note.trim() ? "View/Edit" : "Add"} Note
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
            {capitalizeWords(noteType)} Notes
          </ThemedText>
        </View>
        <Divider style={{ marginTop: 8, marginBottom: 16 }} />
        <TouchableWithoutFeedback
          onPress={() => inputRef.current?.focus()}
          style={{ height: "100%" }}
        >
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <NoteInput
              key={inputKey}
              ref={inputRef}
              defaultValue={currentNoteRef.current}
              onChangeText={(text) => {
                currentNoteRef.current = text;
              }}
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
