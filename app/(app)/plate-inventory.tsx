import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Divider } from "react-native-paper";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import {
  DEFAULT_PLATE_INVENTORY_KG,
  DEFAULT_PLATE_INVENTORY_LBS,
  parsePlateInventory,
  serialisePlateInventory,
  type PlateStock,
} from "@/utils/plateCalculator";
import { radii, useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const MAX_PAIRS = 20;

const formatWeight = (value: number) => String(parseFloat(value.toFixed(2)));

/**
 * Edits the plates the user actually owns, which the plate calculator then
 * works within. Only the inventory for the current weight unit is shown: a kg
 * rack and a lb rack are different physical sets, so they are stored and
 * edited separately rather than converted into one another.
 */
export default function PlateInventoryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();

  const weightUnit = settings?.weightUnit || "kg";
  const isLbs = weightUnit === "lbs";
  const inventoryKey = isLbs ? "plateInventoryLbs" : "plateInventoryKg";

  const storedValue = settings?.[inventoryKey];

  const [plates, setPlates] = useState<PlateStock[]>(() =>
    parsePlateInventory(storedValue, weightUnit),
  );
  const [newWeight, setNewWeight] = useState("");

  // Adopt the stored value once settings arrive, and again if the unit changes
  // under us, which swaps to an entirely different inventory.
  useEffect(() => {
    setPlates(parsePlateInventory(storedValue, weightUnit));
  }, [storedValue, weightUnit]);

  const persist = (next: PlateStock[]) => {
    setPlates(next);
    updateSetting({ key: inventoryKey, value: serialisePlateInventory(next) });
  };

  const changePairs = (weight: number, delta: number) => {
    persist(
      plates.map((plate) =>
        plate.weight === weight
          ? {
              ...plate,
              pairs: Math.min(MAX_PAIRS, Math.max(0, plate.pairs + delta)),
            }
          : plate,
      ),
    );
  };

  const removePlate = (weight: number) => {
    persist(plates.filter((plate) => plate.weight !== weight));
  };

  /**
   * Returns false only when a typed size was rejected, so a caller that is on
   * its way out of the screen knows to stay and let the user see why.
   */
  const addPlate = () => {
    const parsed = parseFloat(newWeight);
    if (!Number.isFinite(parsed) || parsed <= 0) return true;

    if (plates.some((plate) => plate.weight === parsed)) {
      Alert.alert(
        t`Already added`,
        t`You already have a ${formatWeight(parsed)} ${weightUnit} plate in the list.`,
      );
      return false;
    }

    setNewWeight("");
    persist([...plates, { weight: parsed, pairs: 1 }]);
    return true;
  };

  /**
   * Every edit is already written as it happens, so this only picks up a size
   * still sitting unadded in the input before leaving. It exists because
   * relying on the back button to mean "done" is not obvious.
   */
  const handleDone = () => {
    if (!addPlate()) return;
    router.back();
  };

  const resetToDefaults = () => {
    Alert.alert(
      t`Reset plates`,
      t`Restore the standard ${weightUnit} plate set? Your changes will be lost.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Reset`,
          style: "destructive",
          onPress: () =>
            persist(
              isLbs ? DEFAULT_PLATE_INVENTORY_LBS : DEFAULT_PLATE_INVENTORY_KG,
            ),
        },
      ],
    );
  };

  const handleNewWeightChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    setNewWeight(
      parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned,
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText style={styles.intro}>
          <Trans>
            Set how many pairs of each plate you have. The plate calculator will
            only suggest loads you can actually build.
          </Trans>
        </ThemedText>

        <ThemedText style={styles.sectionHeader}>
          <Trans>Plates ({weightUnit})</Trans>
        </ThemedText>

        <ThemedText style={styles.pairsHint}>
          <Trans>Counts are pairs: one plate for each side of the bar.</Trans>
        </ThemedText>

        {plates.length === 0 ? (
          <ThemedText style={styles.empty}>
            <Trans>No plates yet. Add one below.</Trans>
          </ThemedText>
        ) : (
          plates.map((plate) => (
            <View key={plate.weight} style={styles.row}>
              <ThemedText style={styles.plateWeight}>
                {formatWeight(plate.weight)} {weightUnit}
              </ThemedText>

              <View style={styles.stepper}>
                <AppIcon
                  set="mci"
                  name="minus-circle-outline"
                  size={28}
                  color={
                    plate.pairs === 0
                      ? colors.contentDisabled
                      : colors.contentPrimary
                  }
                  onPress={() => changePairs(plate.weight, -1)}
                />
                <ThemedText
                  style={[
                    styles.pairCount,
                    plate.pairs === 0 && styles.pairCountZero,
                  ]}
                >
                  {plate.pairs}
                </ThemedText>
                <AppIcon
                  set="mci"
                  name="plus-circle-outline"
                  size={28}
                  color={
                    plate.pairs >= MAX_PAIRS
                      ? colors.contentDisabled
                      : colors.contentPrimary
                  }
                  onPress={() => changePairs(plate.weight, 1)}
                />
              </View>

              <AppIcon
                set="mci"
                name="trash-can-outline"
                size={24}
                color={colors.danger}
                onPress={() => removePlate(plate.weight)}
              />
            </View>
          ))
        )}

        <Divider style={styles.divider} />

        <ThemedText style={styles.sectionHeader}>
          <Trans>Add a plate size</Trans>
        </ThemedText>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newWeight}
            onChangeText={handleNewWeightChange}
            keyboardType="numeric"
            placeholder={t`Weight in ${weightUnit}`}
            placeholderTextColor={colors.contentDisabled}
            onSubmitEditing={addPlate}
          />
          <TouchableOpacity
            style={[styles.addButton, !newWeight && styles.addButtonDisabled]}
            onPress={addPlate}
            disabled={!newWeight}
          >
            <ThemedText style={styles.addButtonText}>
              <Trans>Add</Trans>
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <Button
            mode="outlined"
            onPress={resetToDefaults}
            textColor={colors.contentSecondary}
            style={styles.actionButton}
          >
            <Trans>Reset plates</Trans>
          </Button>
          <Button
            mode="contained"
            onPress={handleDone}
            buttonColor={colors.accent}
            textColor={colors.onAccent}
            style={styles.actionButton}
          >
            <Trans>Save and go back</Trans>
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      padding: 16,
      paddingBottom: 32,
    },
    intro: {
      fontSize: 14,
      color: colors.contentSecondary,
      marginBottom: 20,
    },
    sectionHeader: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 8,
      color: colors.contentPrimary,
    },
    empty: {
      fontSize: 15,
      color: colors.contentSecondary,
      paddingVertical: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: radii.md,
      backgroundColor: colors.cardSecondary,
    },
    plateWeight: {
      flex: 1,
      fontSize: 17,
      color: colors.contentPrimary,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginRight: 16,
    },
    pairCount: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.contentPrimary,
      minWidth: 24,
      textAlign: "center",
    },
    pairCountZero: {
      color: colors.contentDisabled,
    },
    pairsHint: {
      fontSize: 13,
      color: colors.contentSecondary,
      marginBottom: 12,
    },
    divider: {
      marginVertical: 20,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    input: {
      flex: 1,
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 16,
    },
    addButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: radii.md,
      backgroundColor: colors.accent,
    },
    addButtonDisabled: {
      backgroundColor: colors.controlDisabledBg,
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.onAccent,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 28,
    },
    actionButton: {
      flex: 1,
      borderRadius: radii.md,
      borderColor: colors.contentSecondary,
    },
  });
}
