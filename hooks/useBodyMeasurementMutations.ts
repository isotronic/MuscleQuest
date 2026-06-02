import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import Bugsnag from "@bugsnag/expo";
import {
  insertBodyMeasurementSession,
  updateBodyMeasurementSession,
  deleteBodyMeasurementSession,
} from "@/utils/database";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { pushBodyMeasurement } from "@/utils/sharing";
import {
  toCanonicalValue,
  type ValueKind,
  type MeasurementDisplayOptions,
} from "@/utils/measurementConversions";

type DisplayValue = {
  metric_id: number;
  value_kind: ValueKind;
  displayValue: number;
};

const invalidateBodyMeasurements = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  queryClient.invalidateQueries({ queryKey: ["bodyMeasurements"] });
};

export const useInsertBodyMeasurementMutation = (
  options: MeasurementDisplayOptions,
) => {
  const queryClient = useQueryClient();
  const user = useContext(AuthContext);
  const { privacySettings } = useSocialStore();
  return useMutation({
    mutationFn: ({
      recorded_at,
      values,
    }: {
      recorded_at: string;
      values: DisplayValue[];
    }) => {
      const canonicalValues = values
        .filter((v) => !isNaN(v.displayValue))
        .map((v) => ({
          metric_id: v.metric_id,
          value: toCanonicalValue(v.displayValue, v.value_kind, options),
        }));
      return insertBodyMeasurementSession(recorded_at, canonicalValues);
    },
    onSuccess: (entryId) => {
      invalidateBodyMeasurements(queryClient);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (user && privacySettings?.shareBodyMeasurements && entryId) {
        pushBodyMeasurement(user.uid, entryId).catch((err) =>
          Bugsnag.notify(err),
        );
      }
    },
    onError: (error) => {
      console.error("Failed to insert body measurement session:", error);
      Bugsnag.notify(error);
    },
  });
};

export const useUpdateBodyMeasurementMutation = (
  options: MeasurementDisplayOptions,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entry_id,
      values,
    }: {
      entry_id: number;
      values: DisplayValue[];
    }) => {
      const canonicalValues = values
        .filter((v) => !isNaN(v.displayValue))
        .map((v) => ({
          metric_id: v.metric_id,
          value: toCanonicalValue(v.displayValue, v.value_kind, options),
        }));
      return updateBodyMeasurementSession(entry_id, canonicalValues);
    },
    onSuccess: () => {
      invalidateBodyMeasurements(queryClient);
    },
    onError: (error) => {
      console.error("Failed to update body measurement session:", error);
      Bugsnag.notify(error);
    },
  });
};

export const useDeleteBodyMeasurementMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry_id: number) => deleteBodyMeasurementSession(entry_id),
    onSuccess: () => {
      invalidateBodyMeasurements(queryClient);
    },
    onError: (error) => {
      console.error("Failed to delete body measurement session:", error);
      Bugsnag.notify(error);
    },
  });
};
