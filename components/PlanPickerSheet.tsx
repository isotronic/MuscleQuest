import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { MessageDescriptor } from "@lingui/core";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { ThemedText } from "@/components/ThemedText";
import { PlanMetaChips, planDaysLabel } from "@/components/PlanMetaChips";
import {
  PLAN_EQUIPMENT_LABELS,
  PLAN_LEVEL_LABELS,
  PREMADE_PLAN_META,
  type PlanEquipment,
  type PlanLevel,
} from "@/constants/premadePlanMeta";
import { rankPremadePlans, type RankedPlan } from "@/utils/planPicker";
import type { Plan } from "@/hooks/useAllPlansQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const DAY_OPTIONS = [2, 3, 4, 5, 6];

const EXPERIENCE_OPTIONS: { value: PlanLevel; label: MessageDescriptor }[] = [
  { value: "beginner", label: msg`New to lifting` },
  { value: "intermediate", label: msg`Some experience` },
  { value: "advanced", label: msg`A lot of experience` },
];

const EQUIPMENT_OPTIONS: { value: PlanEquipment; label: MessageDescriptor }[] =
  [
    { value: "gym", label: msg`A gym` },
    { value: "dumbbells", label: msg`Dumbbells` },
    { value: "none", label: msg`No equipment` },
  ];

interface PlanPickerSheetProps {
  /** The premade plans, as listed on the Plans tab. */
  plans: Plan[];
  onSelectPlan: (plan: Plan) => void;
}

type Step = "days" | "experience" | "equipment" | "result";

function reasonFor(
  ranked: RankedPlan,
  translate: (d: MessageDescriptor) => string,
): string {
  const meta = PREMADE_PLAN_META[ranked.appPlanId];
  const parts: string[] = [];
  if (ranked.matches.days) parts.push(planDaysLabel(meta.daysPerWeek));
  if (ranked.matches.level)
    parts.push(translate(PLAN_LEVEL_LABELS[meta.level]));
  if (ranked.matches.equipment) {
    parts.push(translate(PLAN_EQUIPMENT_LABELS[meta.equipment]));
  }
  if (parts.length === 0) return t`Closest fit to your answers`;
  const matched = parts.join(", ");
  return t`Matches ${matched}`;
}

/**
 * "Help me choose": three questions (days, experience, equipment), then the
 * two premade plans that fit best, each with why.
 */
const PlanPickerSheet = React.forwardRef<
  BottomSheetModal,
  PlanPickerSheetProps
>(function PlanPickerSheet({ plans, onSelectPlan }, ref) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const [step, setStep] = useState<Step>("days");
  const [days, setDays] = useState<number | null>(null);
  const [level, setLevel] = useState<PlanLevel | null>(null);
  const [equipment, setEquipment] = useState<PlanEquipment | null>(null);

  const reset = useCallback(() => {
    setStep("days");
    setDays(null);
    setLevel(null);
    setEquipment(null);
  }, []);

  const results = useMemo(() => {
    if (days == null || level == null || equipment == null) return [];
    return rankPremadePlans({ days, level, equipment }, PREMADE_PLAN_META)
      .map((ranked) => ({
        ranked,
        plan: plans.find((p) => p.app_plan_id === ranked.appPlanId),
      }))
      .filter((r): r is { ranked: RankedPlan; plan: Plan } => !!r.plan)
      .slice(0, 2);
  }, [days, level, equipment, plans]);

  const back = () =>
    setStep((s) =>
      s === "result" ? "equipment" : s === "equipment" ? "experience" : "days",
    );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    [],
  );

  const option = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <ThemedText
        style={[styles.optionLabel, selected && styles.optionLabelSelected]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <AppBottomSheet
      ref={ref}
      snapPoints={["60%", "90%"]}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={reset}
    >
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          <Trans>Which plan?</Trans>
        </ThemedText>

        {step === "days" && (
          <>
            <ThemedText style={styles.question}>
              <Trans>How many days a week can you train?</Trans>
            </ThemedText>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {DAY_OPTIONS.map((d) =>
                option(String(d), planDaysLabel(d), days === d, () => {
                  setDays(d);
                  setStep("experience");
                }),
              )}
            </View>
          </>
        )}

        {step === "experience" && (
          <>
            <ThemedText style={styles.question}>
              <Trans>How much lifting experience do you have?</Trans>
            </ThemedText>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {EXPERIENCE_OPTIONS.map((o) =>
                option(o.value, _(o.label), level === o.value, () => {
                  setLevel(o.value);
                  setStep("equipment");
                }),
              )}
            </View>
          </>
        )}

        {step === "equipment" && (
          <>
            <ThemedText style={styles.question}>
              <Trans>What can you train with?</Trans>
            </ThemedText>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {EQUIPMENT_OPTIONS.map((o) =>
                option(o.value, _(o.label), equipment === o.value, () => {
                  setEquipment(o.value);
                  setStep("result");
                }),
              )}
            </View>
          </>
        )}

        {step === "result" && (
          <>
            <ThemedText style={styles.question}>
              <Trans>These plans fit best</Trans>
            </ThemedText>
            {results.map(({ ranked, plan }) => (
              <TouchableOpacity
                key={ranked.appPlanId}
                style={styles.result}
                onPress={() => onSelectPlan(plan)}
                accessibilityRole="button"
                accessibilityHint={t`Opens the plan`}
              >
                <ThemedText style={styles.resultName}>{plan.name}</ThemedText>
                <ThemedText style={styles.resultReason}>
                  {reasonFor(ranked, _)}
                </ThemedText>
                <PlanMetaChips appPlanId={plan.app_plan_id} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {step !== "days" && (
          <Button
            mode="text"
            onPress={back}
            textColor={colors.contentSecondary}
            style={styles.back}
          >
            <Trans>Back</Trans>
          </Button>
        )}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

export default PlanPickerSheet;

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: "600",
      marginBottom: 12,
    },
    question: {
      fontSize: 16,
      marginBottom: 12,
    },
    options: {
      gap: 8,
    },
    option: {
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.surfaceHighlight,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    optionSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    optionLabel: {
      fontSize: 16,
      color: colors.contentPrimary,
    },
    optionLabelSelected: {
      color: colors.onAccent,
    },
    result: {
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      padding: 14,
      marginBottom: 10,
      gap: 6,
    },
    resultName: {
      fontSize: 17,
      fontWeight: "600",
    },
    resultReason: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    back: {
      alignSelf: "flex-start",
      marginTop: 8,
    },
  });
}
