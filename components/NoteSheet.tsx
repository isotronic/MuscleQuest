import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View, TouchableOpacity, TextInput as RNTextInput } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { t } from "@lingui/core/macro";
import { Divider } from "react-native-paper";
import { Pressable } from "react-native-gesture-handler";
import { AppIcon } from "@/components/ui";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { ThemedText } from "./ThemedText";
import { useAppTheme } from "@/theme";

const NoteInput = BottomSheetTextInput as unknown as React.ComponentType<
  React.ComponentPropsWithoutRef<typeof RNTextInput> & { ref?: React.Ref<any> }
>;

export interface NoteSheetHandle {
  /** Opens the sheet with `initial` in the field. */
  open: (initial: string) => void;
}

interface NoteSheetProps {
  title: string;
  placeholder: string;
  /** Called on close with the trimmed text, only when it changed. */
  onSave: (text: string) => void;
}

/** A bottom sheet with one multiline field that saves when it closes. */
export const NoteSheet = forwardRef<NoteSheetHandle, NoteSheetProps>(
  function NoteSheet({ title, placeholder, onSave }, ref) {
    const { colors } = useAppTheme();
    const bottomSheetRef = useRef<any>(null);
    const inputRef = useRef<any>(null);
    // Refs track the live text without triggering re-renders on each keystroke
    const currentNoteRef = useRef("");
    const initialNoteRef = useRef("");
    const [inputKey, setInputKey] = useState(0);

    useImperativeHandle(ref, () => ({
      open: (initial: string) => {
        currentNoteRef.current = initial;
        initialNoteRef.current = initial;
        setInputKey((k) => k + 1);
        bottomSheetRef.current?.present();
      },
    }));

    const handleSaveOnClose = useCallback(() => {
      const text = currentNoteRef.current.trim();
      if (text !== initialNoteRef.current.trim()) {
        onSave(text);
      }
    }, [onSave]);

    return (
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
              onPress={() => bottomSheetRef.current?.dismiss()}
              style={{ alignSelf: "flex-start" }}
              accessibilityRole="button"
              accessibilityLabel={t`Close`}
            >
              <AppIcon
                set="mci"
                name="chevron-down"
                size={28}
                color={colors.contentPrimary}
              />
            </TouchableOpacity>
            <ThemedText style={{ fontSize: 20 }}>{title}</ThemedText>
          </View>
          <Divider style={{ marginTop: 8, marginBottom: 16 }} />
          {/* Only enlarges the tap target for the field; screen readers go
              straight to the input. */}
          <Pressable
            accessible={false}
            accessibilityLabel={title}
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
                placeholder={placeholder}
                accessibilityLabel={title}
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
    );
  },
);
