import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Exercise progress now lives on the exercise screen. Kept so persisted
 * navigation state and old links still land somewhere.
 */
export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  return (
    <Redirect
      href={{
        pathname: "/(app)/exercise-info",
        params: { exercise_id: exerciseId ?? "", tab: "progress" },
      }}
    />
  );
}
