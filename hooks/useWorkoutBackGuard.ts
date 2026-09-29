import { useEffect, type RefObject } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";
import { t } from "@lingui/core/macro";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

/**
 * Confirms before the workout overview is removed (Android back, header back,
 * swipe) while a session is in progress. Leaving keeps the session, so it can
 * be resumed from home. `isLeavingRef` is set by Finish and Cancel, which
 * navigate away on purpose.
 */
export function useWorkoutBackGuard(isLeavingRef: RefObject<boolean>) {
  const navigation = useNavigation();

  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      if (
        isLeavingRef.current ||
        !useActiveWorkoutStore.getState().isWorkoutInProgress()
      ) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        t`Leave workout?`,
        t`Your progress is saved. You can resume from the home screen.`,
        [
          { text: t`Stay`, style: "cancel" },
          { text: t`Leave`, onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
  }, [navigation, isLeavingRef]);
}
