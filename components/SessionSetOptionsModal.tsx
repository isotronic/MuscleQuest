import React, { useMemo } from "react";
import { t } from "@lingui/core/macro";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import {
  SetOptionsModal,
  SetOptionsInitialValues,
  SetOptionsValues,
} from "./SetOptionsModal";

interface SessionSetOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  exerciseIndex: number;
  setIndex: number;
  distanceUnit?: string;
}

/**
 * In-workout set editor, opened from the three-dot menu. Edits the rep range
 * (or time/distance target) and rest time of the current set. Warm-up, drop
 * set and to-failure stay in the three-dot menu itself, so the set-type
 * checkboxes are hidden here.
 *
 * Writes to the active workout's copy of the plan, so changes ride the
 * existing end-of-workout "Save Changes to Plan?" prompt exactly like the
 * other on-the-fly edits.
 */
export const SessionSetOptionsModal: React.FC<SessionSetOptionsModalProps> = ({
  visible,
  onClose,
  exerciseIndex,
  setIndex,
  distanceUnit = "m",
}) => {
  const workout = useActiveWorkoutStore((state) => state.workout);
  const updateSetDetails = useActiveWorkoutStore(
    (state) => state.updateSetDetails,
  );

  const exercise = workout?.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  const trackingType = exercise ? resolvedTrackingType(exercise) : "weight";

  const initialValues = useMemo<SetOptionsInitialValues>(
    () => ({
      repsMin: set?.repsMin !== undefined ? String(set.repsMin) : "",
      repsMax: set?.repsMax !== undefined ? String(set.repsMax) : "",
      restTotalSeconds: set ? set.restMinutes * 60 + set.restSeconds : 0,
      timeSeconds: set?.time ?? 0,
      distance: set?.distance !== undefined ? String(set.distance) : "",
      isWarmup: set?.isWarmup ?? false,
      isDropSet: set?.isDropSet ?? false,
      isToFailure: set?.isToFailure ?? false,
    }),
    [set],
  );

  if (!set) return null;

  const handleSave = (values: SetOptionsValues, applyToAllSets: boolean) => {
    const fields =
      trackingType === "time"
        ? { time: values.time }
        : trackingType === "distance"
          ? { distance: values.distance }
          : { repsMin: values.repsMin, repsMax: values.repsMax };

    updateSetDetails(
      exerciseIndex,
      setIndex,
      {
        ...fields,
        restMinutes: values.restMinutes,
        restSeconds: values.restSeconds,
      },
      applyToAllSets,
    );
  };

  return (
    <SetOptionsModal
      visible={visible}
      onClose={onClose}
      trackingType={trackingType}
      distanceUnit={distanceUnit}
      initialValues={initialValues}
      defaultRepsMin={set.repsMin ?? 0}
      defaultRepsMax={set.repsMax ?? 0}
      showSetTypeOptions={false}
      saveLabel={t`Save Set`}
      onSave={handleSave}
    />
  );
};
