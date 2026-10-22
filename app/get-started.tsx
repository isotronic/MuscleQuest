import { useEffect, useMemo } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trans } from "@lingui/react/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StarterPlanList } from "@/components/StarterPlanList";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { openPlanOverview } from "@/utils/planNavigation";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * The end of onboarding: a starter plan, a quick workout, or straight home.
 * Setup's Finish waited for the background seeding, so the plans are in.
 */
export default function GetStartedScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // Nothing is under this screen; Back goes home like "Skip, go to home"
  // instead of closing the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.replace("/");
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title" style={styles.title}>
          <Trans>You're set</Trans>
        </ThemedText>
        <ThemedText style={styles.hint}>
          <Trans>Pick a plan to follow, or start training right away.</Trans>
        </ThemedText>
        <StarterPlanList
          onSelect={(planId) => openPlanOverview(planId, { replace: true })}
        />
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => {
              router.replace("/");
              void confirmStartWorkout(
                () => {},
                () => useActiveWorkoutStore.getState().startQuickWorkout(),
              );
            }}
          >
            <Trans>Start a quick workout</Trans>
          </Button>
          <Button
            mode="text"
            testID="get-started-skip"
            onPress={() => router.replace("/")}
          >
            <Trans>Skip, go to home</Trans>
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    scroll: { flexGrow: 1, justifyContent: "center" },
    title: { marginBottom: 4, color: colors.contentPrimary },
    hint: { color: colors.contentSecondary, marginBottom: 16 },
    actions: { marginTop: 8, gap: 8 },
  });
}
