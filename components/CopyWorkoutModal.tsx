import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { Portal, Modal, Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface CopyWorkoutModalProps {
  visible: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onDismiss: () => void;
  isPending: boolean;
}

export function CopyWorkoutModal({
  visible,
  defaultName,
  onConfirm,
  onDismiss,
  isPending,
}: CopyWorkoutModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const nameRef = useRef(defaultName);
  const [isEmpty, setIsEmpty] = useState(!defaultName.trim());
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    if (visible) {
      nameRef.current = defaultName;
      setIsEmpty(!defaultName.trim());
      setInputKey((k) => k + 1);
    }
  }, [visible, defaultName]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={!isPending}
        contentContainerStyle={styles.modal}
      >
        <ThemedText style={styles.title}>
          <Trans>Copy Workout</Trans>
        </ThemedText>
        <TextInput
          key={inputKey}
          style={styles.input}
          defaultValue={defaultName}
          onChangeText={(text) => {
            nameRef.current = text;
            setIsEmpty(!text.trim());
          }}
          placeholder={t`Workout name`}
          placeholderTextColor={colors.contentSecondary}
          autoFocus
        />
        <View style={styles.actions}>
          <Button mode="text" onPress={onDismiss} disabled={isPending} testID="copy-modal-cancel">
            <Trans>Cancel</Trans>
          </Button>
          <Button
            mode="contained"
            onPress={() => onConfirm(nameRef.current.trim())}
            disabled={isEmpty || isPending}
            loading={isPending}
            theme={{ colors: { primary: colors.accent } }}
            testID="copy-modal-confirm"
          >
            <Trans>Copy</Trans>
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modal: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: 24,
      marginHorizontal: 24,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 16,
      color: colors.contentPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      borderRadius: radii.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.contentPrimary,
      marginBottom: 20,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
  });
}
