import { displayToKg, roundCanonical } from "@/utils/units";
import type { WeekStartDay } from "@/utils/week";

export type UnitSystem = "metric" | "imperial";

/** The unit settings each choice on the setup screen writes. */
export const UNIT_SETTINGS: Record<
  UnitSystem,
  { weightUnit: string; distanceUnit: string; sizeUnit: string }
> = {
  metric: { weightUnit: "kg", distanceUnit: "m", sizeUnit: "cm" },
  imperial: { weightUnit: "lbs", distanceUnit: "ft", sizeUnit: "in" },
};

export const unitSystemOf = (weightUnit: string | undefined): UnitSystem =>
  weightUnit === "lbs" ? "imperial" : "metric";

/** What the setup screen holds; strings as the settings store them. */
export interface SetupValues {
  units: UnitSystem;
  /** In the chosen weight unit, like the weightIncrement setting. */
  weightIncrement: string;
  weeklyGoal: string;
  weekStartsOn: WeekStartDay;
  /**
   * Only what the user typed, in the chosen weight unit; "" leaves body
   * weight as it is. The screen shows the stored weight as a placeholder
   * rather than a value, so confirming does not log it again.
   */
  bodyWeight: string;
}

export interface SetupWrite {
  settings: { key: string; value: string }[];
  /** Set when the week start changed; goes through saveWeekStart. */
  weekStartsOn?: WeekStartDay;
  /** On first run there are no weeks to keep, so it applies at once. */
  weekStartImmediately?: boolean;
  /** Set when a body weight was entered; logged as a measurement too. */
  bodyWeightKg?: number;
}

/**
 * The writes for confirming setup: only what differs from what the screen
 * opened with, so an older install that confirms without changes keeps
 * every value, mixed units included.
 */
export function setupChanges(
  initial: SetupValues,
  values: SetupValues,
  { firstRun = false }: { firstRun?: boolean } = {},
): SetupWrite {
  const write: SetupWrite = { settings: [] };
  if (values.units !== initial.units) {
    for (const [key, value] of Object.entries(UNIT_SETTINGS[values.units])) {
      write.settings.push({ key, value });
    }
  }
  if (values.weightIncrement !== initial.weightIncrement) {
    write.settings.push({
      key: "weightIncrement",
      value: values.weightIncrement,
    });
  }
  if (values.weeklyGoal !== initial.weeklyGoal) {
    write.settings.push({ key: "weeklyGoal", value: values.weeklyGoal });
  }
  if (values.weekStartsOn !== initial.weekStartsOn) {
    write.weekStartsOn = values.weekStartsOn;
    write.weekStartImmediately = firstRun;
  }
  const bodyWeight = parseFloat(values.bodyWeight);
  if (Number.isFinite(bodyWeight) && bodyWeight > 0) {
    write.bodyWeightKg = roundCanonical(
      displayToKg(bodyWeight, UNIT_SETTINGS[values.units].weightUnit),
    );
  }
  return write;
}
