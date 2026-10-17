import React, { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Menu } from "react-native-paper";
import { t } from "@lingui/core/macro";
import { AppIconButton } from "@/components/ui";
import { useAppTheme } from "@/theme";

interface Props {
  /** The ⋮ button's icon size. */
  size: number;
  buttonStyle?: StyleProp<ViewStyle>;
  /** Spoken name of the button; says which set in a list of them. */
  accessibilityLabel?: string;
  onOpenPlateCalculator?: () => void;
  onEditSet?: () => void;
  onRemoveSet: () => void;
  onAddSet: () => void;
  onAddDropSet: () => void;
  onToggleSetType: (type: "isWarmup" | "isToFailure") => void;
  isWarmup: boolean;
  isToFailure: boolean;
  onEditNote?: () => void;
  hasNote: boolean;
  /** Only for a reps exercise, which can track weight this session. */
  onToggleWeighted?: () => void;
  isWeightedOverrideEnabled?: boolean;
}

/** A set's ⋮ menu, as on the focus screen and in the list logging mode. */
export function SetOptionsMenu({
  size,
  buttonStyle,
  accessibilityLabel,
  onOpenPlateCalculator,
  onEditSet,
  onRemoveSet,
  onAddSet,
  onAddDropSet,
  onToggleSetType,
  isWarmup,
  isToFailure,
  onEditNote,
  hasNote,
  onToggleWeighted,
  isWeightedOverrideEnabled = false,
}: Props) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const close = () => setVisible(false);
  const run = (action: () => void) => () => {
    action();
    close();
  };

  return (
    <Menu
      visible={visible}
      onDismiss={close}
      anchor={
        <AppIconButton
          icon="dots-vertical"
          accessibilityLabel={accessibilityLabel ?? t`Set options`}
          onPress={() => setVisible(true)}
          size={size}
          iconColor={colors.contentPrimary}
          style={buttonStyle}
        />
      }
    >
      {!!onOpenPlateCalculator && (
        <Menu.Item
          onPress={run(onOpenPlateCalculator)}
          title={t`Plate Calculator`}
        />
      )}
      {!!onEditSet && (
        <Menu.Item onPress={run(onEditSet)} title={t`Edit Set`} />
      )}
      <Menu.Item onPress={run(onRemoveSet)} title={t`Delete Set`} />
      <Menu.Item onPress={run(onAddSet)} title={t`Add Set`} />
      <Menu.Item onPress={run(onAddDropSet)} title={t`Add Drop Set`} />
      <Menu.Item
        onPress={run(() => onToggleSetType("isWarmup"))}
        title={t`Warm-up`}
        leadingIcon={isWarmup ? "check" : undefined}
      />
      <Menu.Item
        onPress={run(() => onToggleSetType("isToFailure"))}
        title={t`To Failure`}
        leadingIcon={isToFailure ? "check" : undefined}
      />
      {!!onEditNote && (
        <Menu.Item
          onPress={run(onEditNote)}
          title={hasNote ? t`Edit note` : t`Add note`}
        />
      )}
      {!!onToggleWeighted && (
        <Menu.Item
          onPress={run(onToggleWeighted)}
          title={t`Add Weight`}
          leadingIcon={isWeightedOverrideEnabled ? "check" : undefined}
        />
      )}
    </Menu>
  );
}
