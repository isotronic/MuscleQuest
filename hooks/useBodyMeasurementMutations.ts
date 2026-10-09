import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import {
  insertBodyMeasurementSession,
  updateBodyMeasurementSession,
  deleteBodyMeasurementSession,
} from "@/utils/database";
import { AuthContext } from "@/context/AuthProvider";
import { t } from "@lingui/core/macro";
import { showSnackbar } from "@/store/snackbarStore";
import { usePendingDeleteStore } from "@/store/pendingDeleteStore";
import { useSocialStore } from "@/store/socialStore";
import { pushBodyMeasurement } from "@/utils/sharing";
import {
  syncMeasurementChanged,
  syncMeasurementRemoved,
} from "@/utils/sharedSync";
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
          notifyBugsnag(err),
        );
      }
    },
    onError: (error) => {
      console.error("Failed to insert body measurement session:", error);
      notifyBugsnag(error);
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
    onSuccess: (_data, { entry_id }) => {
      invalidateBodyMeasurements(queryClient);
      syncMeasurementChanged(entry_id);
    },
    onError: (error) => {
      console.error("Failed to update body measurement session:", error);
      notifyBugsnag(error);
    },
  });
};

export const useDeleteBodyMeasurementMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry_id: number) => deleteBodyMeasurementSession(entry_id),
    onSuccess: (_data, entry_id) => {
      invalidateBodyMeasurements(queryClient);
      syncMeasurementRemoved(entry_id);
    },
    onError: (error) => {
      console.error("Failed to delete body measurement session:", error);
      notifyBugsnag(error);
    },
  });
};

/**
 * Deletes a measurement entry with an Undo window. The delete is a hard
 * DELETE, so it is delayed: the entry is hidden straight away and only removed
 * when the snackbar closes without Undo. Runs outside any screen's lifetime,
 * so it calls the database directly instead of going through useMutation.
 */
export const useDeleteBodyMeasurementWithUndo = () => {
  const queryClient = useQueryClient();

  return (entryId: number) => {
    const { hideMeasurement, unhideMeasurement } =
      usePendingDeleteStore.getState();
    hideMeasurement(entryId);
    invalidateBodyMeasurements(queryClient);

    showSnackbar(t`Measurement deleted`, {
      duration: 5000,
      action: { label: t`Undo`, onPress: () => {} },
      onClose: async (undone) => {
        if (!undone) {
          try {
            await deleteBodyMeasurementSession(entryId);
            syncMeasurementRemoved(entryId);
          } catch (error) {
            notifyBugsnag(error);
            showSnackbar(t`Couldn't delete the measurement.`);
          }
        }
        unhideMeasurement(entryId);
        invalidateBodyMeasurements(queryClient);
      },
    });
  };
};
