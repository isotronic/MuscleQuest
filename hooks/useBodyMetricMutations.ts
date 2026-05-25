import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import {
  toggleBodyMetricActive,
  insertCustomBodyMetricDefinition,
  softDeleteCustomBodyMetricDefinition,
  ValueKind,
} from "@/utils/database";

const invalidateDefinitions = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  queryClient.invalidateQueries({ queryKey: ["bodyMetricDefinitions"] });
};

export const useToggleBodyMetricActiveMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleBodyMetricActive(id, is_active),
    onSuccess: () => {
      invalidateDefinitions(queryClient);
    },
    onError: (error) => {
      console.error("Failed to toggle body metric active state:", error);
      Bugsnag.notify(error);
    },
  });
};

export const useInsertCustomBodyMetricMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      label,
      value_kind,
    }: {
      label: string;
      value_kind: ValueKind;
    }) => insertCustomBodyMetricDefinition(label, value_kind),
    onSuccess: () => {
      invalidateDefinitions(queryClient);
    },
    onError: (error) => {
      console.error("Failed to insert custom body metric:", error);
      Bugsnag.notify(error);
    },
  });
};

export const useSoftDeleteCustomBodyMetricMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => softDeleteCustomBodyMetricDefinition(id),
    onSuccess: () => {
      invalidateDefinitions(queryClient);
      queryClient.invalidateQueries({ queryKey: ["bodyMeasurements"] });
    },
    onError: (error) => {
      console.error("Failed to delete custom body metric:", error);
      Bugsnag.notify(error);
    },
  });
};
