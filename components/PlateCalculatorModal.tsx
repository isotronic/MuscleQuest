import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Button, Divider } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import {
  barPresetsFor,
  calculatePlates,
  defaultBarWeightFor,
  parsePlateInventory,
} from "@/utils/plateCalculator";
import { radii, useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface PlateCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  /** The weight currently in the set's input, as typed. */
  targetWeight: string;
  weightUnit: string;
}

/** Trims trailing zeros so 20 reads as "20" and 2.50 as "2.5". */
const formatWeight = (value: number) => String(parseFloat(value.toFixed(2)));

/**
 * Read-only plate breakdown for the weight on the current set, opened from the
 * three-dot menu during a workout. The bar weight is the one thing that is
 * adjustable here, and the choice persists globally so it is only made once.
 */
export const PlateCalculatorModal: React.FC<PlateCalculatorModalProps> = ({
  visible,
  onClose,
  targetWeight,
  weightUnit,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();

  const isLbs = weightUnit === "lbs";
  const barSettingKey = isLbs ? "plateCalcBarLbs" : "plateCalcBarKg";
  const inventoryKey = isLbs ? "plateInventoryLbs" : "plateInventoryKg";

  const savedBarWeight = useMemo(() => {
    const stored = Number(settings?.[barSettingKey]);
    return Number.isFinite(stored) && stored > 0
      ? stored
      : defaultBarWeightFor(weightUnit);
  }, [settings, barSettingKey, weightUnit]);

  const plates = useMemo(
    () => parsePlateInventory(settings?.[inventoryKey], weightUnit),
    [settings, inventoryKey, weightUnit],
  );

  // Draft of the custom bar field. Kept local because committing on every
  // keystroke would invalidate the settings query, and so re-render the app,
  // once per character in the middle of a workout.
  const [customBar, setCustomBar] = useState("");
  const [showCustomBar, setShowCustomBar] = useState(false);

  const presets = barPresetsFor(weightUnit);

  // Seed once per opening. Re-seeding on every savedBarWeight change would
  // overwrite the field as the user types into it.
  const seeded = useRef(false);
  useEffect(() => {
    if (!visible) {
      seeded.current = false;
      return;
    }
    if (seeded.current) return;
    seeded.current = true;

    const isPreset = presets.includes(savedBarWeight);
    setShowCustomBar(!isPreset);
    setCustomBar(isPreset ? "" : formatWeight(savedBarWeight));
  }, [visible, savedBarWeight, presets]);

  const parsedCustomBar = parseFloat(customBar);
  const customBarIsUsable =
    showCustomBar && Number.isFinite(parsedCustomBar) && parsedCustomBar > 0;

  // The breakdown follows the field live, even though the setting only lands
  // when the field is left or the sheet is closed.
  const barWeight = customBarIsUsable ? parsedCustomBar : savedBarWeight;

  const commitCustomBar = () => {
    if (!customBarIsUsable || parsedCustomBar === savedBarWeight) return;
    updateSetting({ key: barSettingKey, value: String(parsedCustomBar) });
  };

  const selectPresetBar = (weight: number) => {
    setShowCustomBar(false);
    setCustomBar("");
    updateSetting({ key: barSettingKey, value: String(weight) });
  };

  const handleCustomBarChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    setCustomBar(
      parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned,
    );
  };

  const handleClose = () => {
    commitCustomBar();
    onClose();
  };

  const parsedTarget = parseFloat(targetWeight);
  const target = Number.isFinite(parsedTarget) ? parsedTarget : 0;

  const result = useMemo(
    () => calculatePlates({ targetWeight: target, barWeight, plates }),
    [target, barWeight, plates],
  );

  const totalPlates = result.plates.reduce((sum, p) => sum + p.count, 0);
  const barLabel = `${formatWeight(barWeight)} ${weightUnit}`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      onDismiss={handleClose}
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <ThemedText style={styles.title}>
                <Trans>Plate Calculator</Trans>
              </ThemedText>

              <ThemedText style={styles.label}>
                <Trans>Bar weight ({weightUnit})</Trans>
              </ThemedText>
              <View style={styles.chipRow}>
                {presets.map((preset) => {
                  const selected = !showCustomBar && savedBarWeight === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => selectPresetBar(preset)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {preset}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => setShowCustomBar(true)}
                  style={[styles.chip, showCustomBar && styles.chipSelected]}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      showCustomBar && styles.chipTextSelected,
                    ]}
                  >
                    <Trans>Custom</Trans>
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {showCustomBar && (
                <TextInput
                  style={styles.input}
                  value={customBar}
                  onChangeText={handleCustomBarChange}
                  onBlur={commitCustomBar}
                  keyboardType="numeric"
                  selectTextOnFocus
                  placeholder={t`Bar weight`}
                  placeholderTextColor={colors.contentDisabled}
                />
              )}

              <Divider style={styles.divider} />

              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>
                  <Trans>Target</Trans>
                </ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {formatWeight(target)} {weightUnit}
                </ThemedText>
              </View>

              {result.status !== "exact" && (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>
                    <Trans>Closest</Trans>
                  </ThemedText>
                  <ThemedText style={[styles.summaryValue, styles.inexact]}>
                    {formatWeight(result.achievedWeight)} {weightUnit} (
                    {result.difference > 0 ? "+" : ""}
                    {formatWeight(result.difference)})
                  </ThemedText>
                </View>
              )}

              {result.status === "below-bar" ? (
                <ThemedText style={styles.message}>
                  <Trans>
                    That is lighter than the bar on its own ({barLabel}).
                  </Trans>
                </ThemedText>
              ) : totalPlates === 0 ? (
                <ThemedText style={styles.message}>
                  <Trans>Empty bar, no plates needed.</Trans>
                </ThemedText>
              ) : (
                <>
                  <ThemedText style={styles.perSideLabel}>
                    <Trans>Per side</Trans>
                  </ThemedText>
                  <ScrollView style={styles.plateList}>
                    {result.plates.map((plate) => (
                      <View key={plate.weight} style={styles.plateRow}>
                        <ThemedText style={styles.plateWeight}>
                          {formatWeight(plate.weight)} {weightUnit}
                        </ThemedText>
                        <ThemedText style={styles.plateCount}>
                          × {plate.count}
                        </ThemedText>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              <Button
                mode="contained"
                onPress={handleClose}
                buttonColor={colors.accent}
                textColor={colors.onAccent}
                style={styles.closeButton}
              >
                <Trans>Close</Trans>
              </Button>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.modalBackdrop,
    },
    modalContent: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: radii.md,
      width: "90%",
    },
    title: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.contentPrimary,
      textAlign: "center",
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      color: colors.contentPrimary,
      marginBottom: 8,
      textAlign: "center",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.cardSecondary,
    },
    chipSelected: {
      backgroundColor: colors.accentSubtle,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 15,
      color: colors.contentSecondary,
    },
    chipTextSelected: {
      color: colors.contentPrimary,
      fontWeight: "600",
    },
    input: {
      marginTop: 12,
      padding: 10,
      borderColor: colors.contentPrimary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      textAlign: "center",
    },
    divider: {
      marginVertical: 16,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    summaryLabel: {
      fontSize: 15,
      color: colors.contentSecondary,
    },
    summaryValue: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    inexact: {
      color: colors.badgeWarmup,
    },
    message: {
      fontSize: 15,
      color: colors.contentSecondary,
      textAlign: "center",
      marginTop: 12,
    },
    perSideLabel: {
      fontSize: 15,
      color: colors.contentSecondary,
      marginTop: 10,
      marginBottom: 6,
    },
    plateList: {
      maxHeight: 220,
    },
    plateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      backgroundColor: colors.cardSecondary,
      marginBottom: 6,
    },
    plateWeight: {
      fontSize: 17,
      color: colors.contentPrimary,
    },
    plateCount: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    closeButton: {
      marginTop: 16,
      borderRadius: radii.md,
    },
  });
}
