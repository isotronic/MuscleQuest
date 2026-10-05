import { requireOptionalNativeModule } from "expo";

type ExactAlarmModule = {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
};

// Android only. Elsewhere (iOS, Jest, a build that predates the module) the
// module is missing and exact timing is treated as available.
const ExactAlarm = requireOptionalNativeModule<ExactAlarmModule>("ExactAlarm");

/** False on Android 12+ when "Alarms & reminders" is off for this app. */
export function canScheduleExactAlarms(): boolean {
  return ExactAlarm?.canScheduleExactAlarms() ?? true;
}

export function openExactAlarmSettings(): void {
  ExactAlarm?.openExactAlarmSettings();
}
