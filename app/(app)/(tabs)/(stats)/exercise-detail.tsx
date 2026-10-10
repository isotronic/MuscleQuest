import { Stack, useLocalSearchParams } from "expo-router";
import { ExerciseProgressTab } from "@/components/exercise/ExerciseProgressTab";

/**
 * Exercise progress now lives on the exercise screen's Progress tab. Kept so
 * persisted navigation state and old links still land somewhere; renders in
 * place rather than redirecting across stacks.
 */
export default function ExerciseDetailScreen() {
  const { exerciseId, name } = useLocalSearchParams<{
    exerciseId: string;
    name?: string;
  }>();
  return (
    <>
      <Stack.Screen options={{ title: name ?? "" }} />
      <ExerciseProgressTab exerciseId={Number(exerciseId ?? 0)} />
    </>
  );
}
