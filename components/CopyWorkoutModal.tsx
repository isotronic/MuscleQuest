import React, { useState, useEffect, useMemo } from "react";
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
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (visible) {
      setName(defaultName);
    }
  }, [visible, defaultName]);

  const trimmed = name.trim();

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
          style={styles.input}
          value={name}
          onChangeText={setName}
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
            onPress={() => onConfirm(trimmed)}
            disabled={!trimmed || isPending}
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
