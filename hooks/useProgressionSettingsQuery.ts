import { useSettingsQuery } from "./useSettingsQuery";
import { UserProgressionIncrements } from "@/types/progression";

export interface ProgressionSettings {
  enabled: boolean;
  increments: UserProgressionIncrements;
}

export const useProgressionSettingsQuery = (): ProgressionSettings => {
  const { data: settings } = useSettingsQuery();

  return {
    enabled: settings?.adaptive_progression_enabled === "1",
    increments: {
      barbellKg: parseFloat(
        settings?.progression_increment_barbell_kg ?? "2.5",
      ),
      dumbbellKg: parseFloat(
        settings?.progression_increment_dumbbell_kg ?? "2.0",
      ),
      cableKg: parseFloat(settings?.progression_increment_cable_kg ?? "2.5"),
      machineKg: parseFloat(
        settings?.progression_increment_machine_kg ?? "2.5",
      ),
    },
  };
};
