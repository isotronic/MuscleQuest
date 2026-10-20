import { useState } from "react";
import { t } from "@lingui/core/macro";
import { SettingsModal } from "@/components/SettingsModal";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { useSaveWeekStartMutation } from "@/hooks/useSaveWeekStartMutation";
import { useWeekRule } from "@/hooks/useWeekRule";
import { localDateKeyToDate } from "@/utils/dates";
import { parseWeekStartDay } from "@/utils/week";
import { rescheduleWorkoutReminders } from "@/utils/workoutReminder";
import { showSnackbar } from "@/store/snackbarStore";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

type SettingType =
  | "number"
  | "radio"
  | "dropdown"
  | "restTime"
  | "reminderTime"
  | "slider";

type InputValue =
  | string
  | number
  | { minutes: number; seconds: number }
  | { hours: number; minutes: number };

const reminderDays = (json: string | undefined): number[] => {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * The edit dialog shared by the settings screens: `showOverlay` opens it for
 * one setting, and `overlay` is the modal to render. Saving applies the
 * setting's own rules (rest time in seconds, body weight in kg and logged as
 * a measurement, week start from the next week, reminders rescheduled).
 */
export function useSettingsOverlay() {
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const { mutateAsync: saveWeekStart } = useSaveWeekStartMutation();
  const weekRule = useWeekRule();

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentSettingKey, setCurrentSettingKey] = useState<string | null>(
    null,
  );
  const [inputValue, setInputValue] = useState<InputValue>("");
  const [settingType, setSettingType] = useState<SettingType | null>(null);
  const [options, setOptions] = useState<string[] | undefined>(undefined);
  const [optionLabels, setOptionLabels] = useState<
    Record<string, string> | undefined
  >(undefined);

  const showOverlay = (
    key: string,
    value: string | number,
    type: SettingType,
    options?: string[],
    labels?: Record<string, string>,
  ) => {
    if (key === "defaultRestTime") {
      const totalSeconds = parseInt(value as string, 10);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setInputValue({ minutes, seconds });
      setSettingType("restTime");
    } else if (key === "workoutReminderTime") {
      const [h, m] = (value as string).split(":").map(Number);
      setInputValue({ hours: h || 0, minutes: m || 0 });
      setSettingType("reminderTime");
    } else {
      setInputValue(value);
      setSettingType(type);
    }

    setCurrentSettingKey(key);
    setOptions(options);
    setOptionLabels(labels);
    setOverlayVisible(true);
  };

  const saveSetting = async () => {
    try {
      if (currentSettingKey === "defaultRestTime") {
        const { minutes, seconds } = inputValue as {
          minutes: number;
          seconds: number;
        };
        const totalSeconds = minutes * 60 + seconds;

        updateSetting({
          key: currentSettingKey as string,
          value: totalSeconds.toString(),
        });
      } else if (currentSettingKey === "workoutReminderTime") {
        const { hours, minutes } = inputValue as {
          hours: number;
          minutes: number;
        };
        const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        updateSetting({ key: "workoutReminderTime", value: timeStr });
        rescheduleWorkoutReminders(
          settings?.workoutReminderEnabled === "true" ? "true" : "false",
          JSON.stringify(reminderDays(settings?.workoutReminderDays)),
          timeStr,
        ).catch((err: any) => {
          notifyBugsnag(err);
          console.error("Failed to reschedule workout reminders:", err);
        });
      } else if (currentSettingKey === "weekStartsOn") {
        const next = parseWeekStartDay(String(inputValue));
        if (next !== undefined && next !== weekRule.weekStartsOn) {
          const saved = await saveWeekStart(next);
          // The running week keeps its start, so say when the change lands.
          if (saved.from) {
            const date = localDateKeyToDate(saved.from).toLocaleDateString(
              undefined,
              { weekday: "long", day: "numeric", month: "long" },
            );
            showSnackbar(t`Your new week starts on ${date}.`);
          }
        }
      } else {
        updateSetting({
          key: currentSettingKey as string,
          value: inputValue.toString(),
        });
      }
    } catch (error: unknown) {
      // Deduplicated: a failed mutation has already reported itself.
      notifyBugsnag(error);
      console.error("Error saving setting:", error);
      showSnackbar(t`Couldn't save the setting. Try again.`);
    } finally {
      setOverlayVisible(false);
    }
  };

  const overlay = (
    <SettingsModal
      visible={overlayVisible}
      settingKey={currentSettingKey}
      inputValue={inputValue}
      onCancel={() => setOverlayVisible(false)}
      onSave={saveSetting}
      onChangeValue={setInputValue}
      settingType={settingType}
      options={options}
      optionLabels={optionLabels}
    />
  );

  return { showOverlay, overlay };
}
