import React, { useMemo } from "react";
import { t } from "@lingui/core/macro";
import { useWorkoutStore } from "@/store/workoutStore";
import {
  SetOptionsModal,
  SetOptionsInitialValues,
  SetOptionsValues,
} from "./SetOptionsModal";

interface EditSetModalProps {
  visible: boolean;
  onClose: () => void;
  workoutIndex: number;
  exerciseId: number;
  setIndex: number | null;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultTotalSeconds: number;
  defaultTime: number;
  defaultDistance: number;
  trackingType: string;
  distanceUnit?: string;
}

/**
 * Plan-editor set editor. Seeds the shared SetOptionsModal from the plan
 * store and writes the result back to it. A null setIndex means "add a new
 * set", seeded from the exercise's last set.
 */
export const EditSetModal: React.FC<EditSetModalProps> = ({
  visible,
  onClose,
  workoutIndex,
  exerciseId,
  setIndex,
  defaultRepsMin,
  defaultRepsMax,
  defaultTotalSeconds,
  defaultTime,
  defaultDistance,
  trackingType,
  distanceUnit = "m",
}) => {
  const updateSetInExercise = useWorkoutStore(
    (state) => state.updateSetInExercise,
  );
  const addSetToExercise = useWorkoutStore((state) => state.addSetToExercise);
  const workouts = useWorkoutStore((state) => state.workouts);

  const exercise = workouts[Number(workoutIndex)]?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );
  const set = setIndex !== null ? exercise?.sets[setIndex] : null;

  const initialValues = useMemo<SetOptionsInitialValues>(() => {
    if (setIndex !== null && set) {
      return {
        repsMin: set.repsMin !== undefined ? String(set.repsMin) : "",
        repsMax: set.repsMax !== undefined ? String(set.repsMax) : "",
        restTotalSeconds: set.restMinutes * 60 + set.restSeconds,
        timeSeconds: set.time ?? 0,
        distance: set.distance !== undefined ? String(set.distance) : "",
        isWarmup: set.isWarmup ?? false,
        isDropSet: set.isDropSet ?? false,
        isToFailure: set.isToFailure ?? false,
      };
    }

    // Adding a new set: carry the exercise's last set forward.
    const prevSets = exercise?.sets;
    const previousSet =
      prevSets && prevSets.length > 0 ? prevSets[prevSets.length - 1] : null;

    return {
      repsMin:
        trackingType === "time" || trackingType === "distance"
          ? ""
          : previousSet?.repsMin !== undefined
            ? String(previousSet.repsMin)
            : defaultRepsMin
              ? String(defaultRepsMin)
              : "",
      repsMax:
        trackingType === "time" || trackingType === "distance"
          ? ""
          : previousSet?.repsMax !== undefined
            ? String(previousSet.repsMax)
            : defaultRepsMax
              ? String(defaultRepsMax)
              : "",
      restTotalSeconds: previousSet
        ? previousSet.restMinutes * 60 + previousSet.restSeconds
        : defaultTotalSeconds,
      timeSeconds:
        trackingType === "time"
          ? (previousSet?.time ?? defaultTime)
          : defaultTime,
      distance:
        trackingType === "distance"
          ? previousSet?.distance !== undefined
            ? String(previousSet.distance)
            : defaultDistance
              ? String(defaultDistance)
              : ""
          : defaultDistance != null
            ? String(defaultDistance)
            : "",
      isWarmup: previousSet?.isWarmup ?? false,
      isDropSet: previousSet?.isDropSet ?? false,
      isToFailure: previousSet?.isToFailure ?? false,
    };
  }, [
    setIndex,
    set,
    exercise,
    trackingType,
    defaultTotalSeconds,
    defaultTime,
    defaultRepsMin,
    defaultRepsMax,
    defaultDistance,
  ]);

  const handleSave = (values: SetOptionsValues, applyToAllSets: boolean) => {
    const updatedSet = {
      repsMin: values.repsMin,
      repsMax: values.repsMax,
      restMinutes: values.restMinutes,
      restSeconds: values.restSeconds,
      time: values.time,
      distance: values.distance,
      isWarmup: values.isWarmup,
      isDropSet: values.isDropSet,
      isToFailure: values.isToFailure,
    };

    if (applyToAllSets) {
      exercise?.sets.forEach((s, sIndex) => {
        if (
          (s.isWarmup ?? false) === values.isWarmup ||
          (setIndex !== null && sIndex === setIndex)
        ) {
          updateSetInExercise(workoutIndex, exerciseId, sIndex, updatedSet);
        }
      });
    } else if (setIndex !== null) {
      // Update only the selected set
      updateSetInExercise(workoutIndex, exerciseId, setIndex, updatedSet);
    } else {
      // Add a new set
      addSetToExercise(workoutIndex, exerciseId, updatedSet);
    }
  };

  return (
    <SetOptionsModal
      visible={visible}
      onClose={onClose}
      trackingType={trackingType}
      distanceUnit={distanceUnit}
      initialValues={initialValues}
      defaultRepsMin={defaultRepsMin}
      defaultRepsMax={defaultRepsMax}
      saveLabel={t`Save Set`}
      onSave={handleSave}
    />
  );
};
