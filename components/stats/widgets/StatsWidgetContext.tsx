import { createContext, useContext } from "react";
import type {
  WorkoutStatsOptions,
  WorkoutSummary,
} from "@/utils/db/workoutStats";

/** What every stats widget shares, provided once by the stats screen. */
export interface StatsWidgetContextValue {
  /** The screen's time range: days as a string, "0" for all time. */
  globalRange: string;
  weightUnit: string;
  distanceUnit: string;
  sizeUnit: "cm" | "in";
  statsOptions: WorkoutStatsOptions;
  excludeDeload: boolean;
  weeklyGoal: number;
  /** Weeks in a row the weekly goal was met, from the screen's streak sync. */
  streak: number | null;
  /** Every completed workout, newest first; undefined while loading. */
  allWorkouts: WorkoutSummary[] | undefined;
  /** Opens the workout calendar, on `date` (a local_date key) if given. */
  openCalendar: (date?: string) => void;
  openWorkout: (completedWorkoutId: number) => void;
}

export const StatsWidgetContext = createContext<StatsWidgetContextValue | null>(
  null,
);

export const useStatsWidgetContext = (): StatsWidgetContextValue => {
  const value = useContext(StatsWidgetContext);
  if (!value) {
    throw new Error("Stats widgets must render inside StatsWidgetContext");
  }
  return value;
};
