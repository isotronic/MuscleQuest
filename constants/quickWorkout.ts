// Name stored for a workout started without a plan workout, and the SQL
// fallback for history rows with none. It stays English in the database,
// exports and shared data; displayWorkoutName (utils/workoutName.ts)
// translates it on screen. Kept free of Lingui so the data layer can use it.
export const QUICK_WORKOUT_NAME = "Quick Workout";
