import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Button,
  SegmentedButtons,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useWeekRule } from "@/hooks/useWeekRule";
import { useSaveSetupMutation } from "@/hooks/useSaveSetupMutation";
import { useWhenSeeded } from "@/hooks/useWhenSeeded";
import { SeedingFailedNotice } from "@/components/SeedingFailedNotice";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { showSnackbar } from "@/store/snackbarStore";
import { DEFAULT_INCREMENT } from "@/utils/localeDefaults";
import { SetupState } from "@/utils/setupState";
import {
  setupChanges,
  unitSystemOf,
  UNIT_SETTINGS,
  type SetupValues,
} from "@/utils/setupChanges";
import { toDisplayDecimal } from "@/utils/numberFormat";

const GOALS = ["1", "2", "3", "4", "5", "6", "7"];
const INCREMENTS = ["1", "2.5", "5"];
const STEP_COUNT = 3;

/** The value list with `current` added when it is not one of the choices. */
const withCurrent = (choices: string[], current: string) =>
  !current || choices.includes(current)
    ? choices
    : [...choices, current].sort((a, b) => parseFloat(a) - parseFloat(b));

/**
 * First-run setup: units and weight steps, weekly goal and week start, then
 * an optional body weight. A new install comes here from the welcome screen;
 * an older install opens it from the home card, prefilled with its current
 * values, and only what the user changes is written.
 */
export default function SetupScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { data: settings } = useSettingsQuery();
  const weekRule = useWeekRule();
  const { mutateAsync: saveSetup, isPending } = useSaveSetupMutation();
  const unitsLocked = useActiveWorkoutStore((s) => s.isWorkoutInProgress());

  const [initial, setInitial] = useState<SetupValues | null>(null);
  const [values, setValues] = useState<SetupValues | null>(null);
  const [step, setStep] = useState(0);
  // Fixed when the screen opens, so saving does not switch the mode.
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    if (!settings || initial) return;
    const opened: SetupValues = {
      units: unitSystemOf(settings.weightUnit),
      weightIncrement: settings.weightIncrement ?? "",
      weeklyGoal: settings.weeklyGoal ?? "3",
      weekStartsOn: weekRule.weekStartsOn,
      bodyWeight: "",
    };
    setInitial(opened);
    setValues(opened);
    setFirstRun(settings.setupDone === SetupState.pending);
  }, [settings, initial, weekRule.weekStartsOn]);

  const seeding = useWhenSeeded();

  // First run only: Back steps through setup and then returns to welcome.
  // An older install opened setup from home, where Back closes it as usual.
  useEffect(() => {
    if (!firstRun) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 0) {
          setStep(step - 1);
        } else {
          // Welcome replaced itself with setup, so it is opened again.
          router.replace("/welcome");
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [firstRun, step]);

  if (!initial || !values || firstRun === null) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  const weightUnit = UNIT_SETTINGS[values.units].weightUnit;
  const update = (patch: Partial<SetupValues>) =>
    setValues({ ...values, ...patch });

  const changeUnits = (units: SetupValues["units"]) => {
    if (units === values.units) return;
    // Back to the units the screen opened with: their step comes back too.
    if (units === initial.units) {
      update({ units, weightIncrement: initial.weightIncrement });
      return;
    }
    // Steps are in the weight unit, so a default step follows the unit.
    const from = UNIT_SETTINGS[values.units].weightUnit as "kg" | "lbs";
    const to = UNIT_SETTINGS[units].weightUnit as "kg" | "lbs";
    update({
      units,
      weightIncrement:
        values.weightIncrement === DEFAULT_INCREMENT[from] ||
        values.weightIncrement === initial.weightIncrement
          ? DEFAULT_INCREMENT[to]
          : values.weightIncrement,
    });
  };

  const write = async (): Promise<boolean> => {
    try {
      await saveSetup(setupChanges(initial, values, { firstRun }));
      return true;
    } catch {
      showSnackbar(t`Couldn't save your setup. Try again.`);
      return false;
    }
  };

  const save = async () => {
    if (!firstRun) {
      if (!(await write())) return;
      showSnackbar(t`Settings saved.`);
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    // The library and plans may still be loading; saving waits for them.
    await seeding.run(async () => {
      if (!(await write())) return;
      // A returning user passed sign-in before setup.
      if (settings?.loginShown === "true") {
        router.replace("/get-started");
      } else {
        router.replace({ pathname: "/login", params: { onboarding: "setup" } });
      }
    });
  };

  const next = () => {
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else void save();
  };

  const storedBodyWeight = settings?.bodyWeight
    ? `${toDisplayDecimal(settings.bodyWeight)} ${settings.weightUnit}`
    : "";

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <ThemedText type="subtitle" style={styles.heading}>
              <Trans>Units</Trans>
            </ThemedText>
            <SegmentedButtons
              value={values.units}
              onValueChange={(v) => changeUnits(v as SetupValues["units"])}
              buttons={[
                {
                  value: "metric",
                  label: t`kg, m, cm`,
                  disabled: unitsLocked,
                },
                {
                  value: "imperial",
                  label: t`lbs, ft, in`,
                  disabled: unitsLocked,
                },
              ]}
            />
            {unitsLocked && (
              <ThemedText style={styles.hint}>
                <Trans>Finish or cancel your workout to change units.</Trans>
              </ThemedText>
            )}
            <ThemedText type="subtitle" style={styles.heading}>
              <Trans>Weight steps</Trans>
            </ThemedText>
            <ThemedText style={styles.hint}>
              <Trans>How much the + and − buttons add during a workout.</Trans>
            </ThemedText>
            <SegmentedButtons
              value={values.weightIncrement}
              onValueChange={(v) => update({ weightIncrement: v })}
              buttons={withCurrent(INCREMENTS, values.weightIncrement).map(
                (value) => ({
                  value,
                  label: `${toDisplayDecimal(value)} ${weightUnit}`,
                }),
              )}
            />
          </>
        );
      case 1:
        return (
          <>
            <ThemedText type="subtitle" style={styles.heading}>
              <Trans>Weekly goal</Trans>
            </ThemedText>
            <ThemedText style={styles.hint}>
              <Trans>
                Training days a week. Your streak counts weeks you reach it.
              </Trans>
            </ThemedText>
            {/* Round chips, since seven segments do not fit a phone. */}
            <View accessibilityRole="radiogroup" style={styles.goalRow}>
              {withCurrent(GOALS, values.weeklyGoal).map((value) => {
                const selected = value === values.weeklyGoal;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => update({ weeklyGoal: value })}
                    style={[styles.goalChip, selected && styles.goalChipOn]}
                  >
                    <ThemedText
                      style={[
                        styles.goalChipText,
                        selected && styles.goalChipTextOn,
                      ]}
                    >
                      {value}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText type="subtitle" style={styles.heading}>
              <Trans>Week starts on</Trans>
            </ThemedText>
            <SegmentedButtons
              value={String(values.weekStartsOn)}
              onValueChange={(v) => update({ weekStartsOn: v === "0" ? 0 : 1 })}
              buttons={[
                { value: "1", label: t`Monday` },
                { value: "0", label: t`Sunday` },
              ]}
            />
            {!firstRun && values.weekStartsOn !== initial.weekStartsOn && (
              <ThemedText style={styles.hint}>
                <Trans>
                  This week keeps its days. The change starts with the next
                  week, and past weeks stay as they were.
                </Trans>
              </ThemedText>
            )}
          </>
        );
      default:
        return (
          <>
            <ThemedText type="subtitle" style={styles.heading}>
              <Trans>Body weight</Trans>
            </ThemedText>
            <ThemedText style={styles.hint}>
              <Trans>
                Used for assisted exercises such as assisted pull-ups. You can
                skip this and add it later.
              </Trans>
            </ThemedText>
            <View style={styles.inputRow}>
              <DecimalInput
                accessibilityLabel={t`Body weight in ${weightUnit}`}
                value={values.bodyWeight}
                onChangeValue={(v) => update({ bodyWeight: v })}
                placeholder={storedBodyWeight}
                placeholderTextColor={colors.contentSecondary}
                style={styles.input}
              />
              <ThemedText style={styles.unit}>{weightUnit}</ThemedText>
            </View>
          </>
        );
    }
  };

  const isLastStep = step === STEP_COUNT - 1;
  const skipBodyWeight = isLastStep && values.bodyWeight === "";

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="title" style={styles.title}>
          {firstRun ? (
            <Trans>Set up MuscleQuest</Trans>
          ) : (
            <Trans>Check your setup</Trans>
          )}
        </ThemedText>
        <ThemedText style={styles.progress}>
          <Trans>
            Step {step + 1} of {STEP_COUNT}
          </Trans>
        </ThemedText>
        {renderStep()}
        {seeding.failed && <SeedingFailedNotice onRetry={seeding.retry} />}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {step > 0 ? (
          <Button mode="text" onPress={() => setStep(step - 1)}>
            <Trans>Back</Trans>
          </Button>
        ) : !firstRun ? (
          <Button mode="text" onPress={() => router.back()}>
            <Trans>Cancel</Trans>
          </Button>
        ) : (
          <View />
        )}
        <Button
          mode="contained"
          onPress={next}
          loading={isPending || seeding.waiting}
          disabled={isPending || seeding.waiting}
        >
          {seeding.waiting ? (
            <Trans>Almost ready…</Trans>
          ) : !isLastStep ? (
            <Trans>Next</Trans>
          ) : skipBodyWeight && firstRun ? (
            <Trans>Skip</Trans>
          ) : firstRun ? (
            <Trans>Finish</Trans>
          ) : (
            <Trans>Save</Trans>
          )}
        </Button>
      </View>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    container: { flex: 1, paddingHorizontal: 16 },
    scroll: { flexGrow: 1, justifyContent: "center", paddingBottom: 24 },
    title: { marginBottom: 4, color: colors.contentPrimary },
    progress: { color: colors.contentSecondary, marginBottom: 8 },
    heading: { marginTop: 24, marginBottom: 8 },
    hint: { color: colors.contentSecondary, marginBottom: 12, marginTop: 4 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 18,
      color: colors.contentPrimary,
    },
    unit: { fontSize: 18, color: colors.contentPrimary },
    goalRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    goalChip: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    goalChipOn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    goalChipText: { fontSize: 16, color: colors.contentPrimary },
    goalChipTextOn: { color: colors.onAccent, fontWeight: "700" },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 12,
    },
  });
}
