import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { Plural } from "@lingui/react/macro";
import { ThemedText } from "./ThemedText";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";

// Ready-made plans suggested to a brand new user, by app_plan_id.
const STARTER_PLANS: { appPlanId: number; description: MessageDescriptor }[] = [
  {
    appPlanId: 1,
    description: msg`Your whole body three times a week. A good first plan.`,
  },
  {
    appPlanId: 2,
    description: msg`Upper and lower body on alternating days.`,
  },
  {
    appPlanId: 5,
    description: msg`No equipment needed. Train anywhere.`,
  },
];

/** The three starter plans, for the home card and the Get started screen. */
export function StarterPlanList({
  onSelect,
}: {
  onSelect: (planId: number) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const { data: plans } = useAllPlansQuery();

  const starterPlans = STARTER_PLANS.flatMap(({ appPlanId, description }) => {
    const plan = plans?.appPlans.find((p) => p.app_plan_id === appPlanId);
    // A stored plan always has an id; the type allows null for drafts.
    return plan?.id != null ? [{ plan, id: plan.id, description }] : [];
  });

  return (
    <View>
      {starterPlans.map(({ plan, id, description }, index) => (
        <Pressable
          key={id}
          testID={`starter-plan-${index}`}
          accessibilityRole="button"
          style={styles.planRow}
          onPress={() => onSelect(id)}
        >
          <ThemedText style={styles.planName}>{plan.name}</ThemedText>
          <ThemedText style={styles.planMeta}>
            <Plural
              value={plan.workouts.length}
              one="# day per week"
              other="# days per week"
            />
          </ThemedText>
          <ThemedText style={styles.planMeta}>{_(description)}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    planRow: {
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    planName: { fontWeight: "600", color: colors.contentPrimary },
    planMeta: { fontSize: 13, color: colors.contentSecondary },
  });
}
