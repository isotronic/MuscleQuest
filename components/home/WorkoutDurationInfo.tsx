import { StyleProp, TextStyle } from "react-native";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimateCompact } from "@/utils/estimateWorkoutDuration";
import type { UserExercise } from "@/store/workoutStore";

/** "5 Exercises · ~45m" for a plan workout. */
export function WorkoutDurationInfo({
  exercises,
  countUnilateralDouble,
  style,
}: {
  exercises: UserExercise[];
  countUnilateralDouble: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { estimate } = useWorkoutDurationEstimate(
    exercises,
    countUnilateralDouble,
  );
  return (
    <ThemedText style={style}>
      <Trans>
        {exercises.length} Exercises
        {estimate ? `  ·  ~${formatDurationEstimateCompact(estimate)}` : ""}
      </Trans>
    </ThemedText>
  );
}
